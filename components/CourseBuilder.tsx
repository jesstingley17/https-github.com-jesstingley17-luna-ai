
import React, { useState, useEffect, useCallback } from 'react';
import { Course, Module, Lesson, QuizQuestion } from '../types';
import { 
  generateCourseStructure, 
  generateLessonContent, 
  generateThumbnail, 
  generateCourseTeaser 
} from '../services/geminiService';

interface CourseBuilderProps {
  initialCourse?: Course;
  onSave: (course: Course) => void;
  onCancel: () => void;
}

const CourseBuilder: React.FC<CourseBuilderProps> = ({ initialCourse, onSave, onCancel }) => {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [course, setCourse] = useState<Course | null>(initialCourse || null);
  const [selectedLesson, setSelectedLesson] = useState<{moduleId: string, lessonId: string} | null>(null);
  const [isListening, setIsListening] = useState<'topic' | 'content' | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  
  // Track per-lesson generation progress
  const [generatingLessonIds, setGeneratingLessonIds] = useState<Set<string>>(new Set());

  // Load initial topic draft if exists
  useEffect(() => {
    if (!course) {
      const savedTopic = localStorage.getItem('edugenius_topic_draft');
      if (savedTopic) setTopic(savedTopic);
    }
  }, [course]);

  // Topic auto-save
  useEffect(() => {
    if (!course && topic) {
      localStorage.setItem('edugenius_topic_draft', topic);
    }
  }, [topic, course]);

  // Auto-save mechanism: Sync current course state to localStorage whenever it changes
  useEffect(() => {
    if (course) {
      const savedData = localStorage.getItem('edugenius_courses');
      let coursesList: Course[] = savedData ? JSON.parse(savedData) : [];
      const existingIndex = coursesList.findIndex(c => c.id === course.id);
      
      if (existingIndex !== -1) {
        // Update existing course in the library
        coursesList[existingIndex] = course;
      } else {
        // Add as a new draft if not present
        coursesList.push(course);
      }
      
      localStorage.setItem('edugenius_courses', JSON.stringify(coursesList));
      setLastSaved(Date.now());
      // Clear topic draft once a course is active
      localStorage.removeItem('edugenius_topic_draft');
    }
  }, [course]);

  // Voice Input Logic
  const handleVoiceInput = useCallback((target: 'topic' | 'content') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please try Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(target);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (target === 'topic') {
        setTopic(prev => prev + (prev ? ' ' : '') + transcript);
      } else if (target === 'content' && selectedLesson) {
        const currentModule = course?.modules.find(m => m.id === selectedLesson.moduleId);
        const currentLesson = currentModule?.lessons.find(l => l.id === selectedLesson.lessonId);
        if (currentLesson) {
          const newContent = (currentLesson.content || '') + (currentLesson.content ? ' ' : '') + transcript;
          updateLessonContent(selectedLesson.moduleId, selectedLesson.lessonId, newContent);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(null);
    };

    recognition.onend = () => {
      setIsListening(null);
    };

    recognition.start();
  }, [course, selectedLesson]);

  const handleInitialGeneration = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setLoadingStatus('Architecting course structure...');
    try {
      const structure = await generateCourseStructure(topic);
      const thumbnail = await generateThumbnail(topic);
      
      setCourse({
        id: Math.random().toString(36).substr(2, 9),
        title: structure.title,
        description: structure.description,
        thumbnail: thumbnail,
        modules: structure.modules.map((m: any) => ({
          ...m,
          lessons: m.lessons.map((l: any) => ({ ...l, content: '' }))
        }))
      });
      setLoadingStatus('');
    } catch (error) {
      console.error(error);
      alert('Failed to generate course. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateLessonBody = async (moduleId: string, lessonId: string) => {
    if (!course) return;
    const lesson = course.modules.find(m => m.id === moduleId)?.lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    setGeneratingLessonIds(prev => new Set(prev).add(lessonId));
    setLoadingStatus(`AI is crafting: ${lesson.title}...`);
    
    try {
      if (lesson.type === 'video') {
        const videoUrl = await generateCourseTeaser(`An educational video about ${lesson.title} for the course ${course.title}`);
        const updatedModules = course.modules.map(m => {
          if (m.id === moduleId) {
            return {
              ...m,
              lessons: m.lessons.map(l => l.id === lessonId ? { ...l, videoUrl } : l)
            };
          }
          return m;
        });
        setCourse({ ...course, modules: updatedModules });
      } else {
        const result = await generateLessonContent(lesson.title, lesson.type === 'quiz' ? 'quiz' : 'text');
        const updatedModules = course.modules.map(m => {
          if (m.id === moduleId) {
            return {
              ...m,
              lessons: m.lessons.map(l => {
                if (l.id === lessonId) {
                  return lesson.type === 'quiz' 
                    ? { ...l, quiz: result } 
                    : { ...l, content: result };
                }
                return l;
              })
            };
          }
          return m;
        });
        setCourse({ ...course, modules: updatedModules });
      }
    } catch (error) {
      console.error(error);
      alert('Content generation failed. Please try again.');
    } finally {
      setGeneratingLessonIds(prev => {
        const next = new Set(prev);
        next.delete(lessonId);
        return next;
      });
      setLoadingStatus('');
    }
  };

  const updateLessonContent = (moduleId: string, lessonId: string, content: string) => {
    if (!course) return;
    setCourse({
      ...course,
      modules: course.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map(l => l.id === lessonId ? { ...l, content } : l)
      } : m)
    });
  };

  const toggleQuizAnswer = (moduleId: string, lessonId: string, qIdx: number, oIdx: number) => {
    if (!course) return;
    setCourse({
      ...course,
      modules: course.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map(l => {
          if (l.id === lessonId && l.quiz) {
            const updatedQuiz = [...l.quiz];
            const q = updatedQuiz[qIdx];
            const currentAnswers = q.correctAnswers || [];
            const newAnswers = currentAnswers.includes(oIdx)
              ? currentAnswers.filter(idx => idx !== oIdx)
              : [...currentAnswers, oIdx];
            updatedQuiz[qIdx] = { ...q, correctAnswers: newAnswers };
            return { ...l, quiz: updatedQuiz };
          }
          return l;
        })
      } : m)
    });
  };

  const addQuizQuestion = (moduleId: string, lessonId: string) => {
    if (!course) return;
    const newQuestion: QuizQuestion = {
      question: "New Question",
      options: ["Option 1", "Option 2"],
      correctAnswers: [0]
    };
    setCourse({
      ...course,
      modules: course.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map(l => l.id === lessonId ? {
          ...l,
          quiz: [...(l.quiz || []), newQuestion]
        } : l)
      } : m)
    });
  };

  const deleteQuizQuestion = (moduleId: string, lessonId: string, qIdx: number) => {
    if (!course) return;
    setCourse({
      ...course,
      modules: course.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map(l => l.id === lessonId ? {
          ...l,
          quiz: l.quiz?.filter((_, i) => i !== qIdx)
        } : l)
      } : m)
    });
  };

  const updateQuizQuestionText = (moduleId: string, lessonId: string, qIdx: number, text: string) => {
    if (!course) return;
    setCourse({
      ...course,
      modules: course.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map(l => l.id === lessonId ? {
          ...l,
          quiz: l.quiz?.map((q, i) => i === qIdx ? { ...q, question: text } : q)
        } : l)
      } : m)
    });
  };

  const updateOptionText = (moduleId: string, lessonId: string, qIdx: number, oIdx: number, text: string) => {
    if (!course) return;
    setCourse({
      ...course,
      modules: course.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map(l => l.id === lessonId ? {
          ...l,
          quiz: l.quiz?.map((q, i) => i === qIdx ? {
            ...q,
            options: q.options.map((opt, oi) => oi === oIdx ? text : opt)
          } : q)
        } : l)
      } : m)
    });
  };

  const addOption = (moduleId: string, lessonId: string, qIdx: number) => {
    if (!course) return;
    setCourse({
      ...course,
      modules: course.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map(l => l.id === lessonId ? {
          ...l,
          quiz: l.quiz?.map((q, i) => i === qIdx ? {
            ...q,
            options: [...q.options, "New Option"]
          } : q)
        } : l)
      } : m)
    });
  };

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-6">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-blue-50 rounded-2xl mb-6">
            <i className="fas fa-magic text-4xl text-blue-600"></i>
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">What will you build today?</h2>
          <p className="text-lg text-gray-600">Enter a topic and let EduGenius craft a professional curriculum in seconds.</p>
        </div>
        
        <div className="bg-white p-2 rounded-3xl shadow-2xl border border-gray-100 flex items-center transition-all focus-within:ring-4 focus-within:ring-blue-100 pr-4">
          <input
            type="text"
            placeholder="e.g. Advanced Digital Marketing 2024"
            className="flex-1 p-6 text-xl text-gray-800 placeholder-gray-400 focus:outline-none rounded-l-2xl"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleInitialGeneration()}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVoiceInput('topic')}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                isListening === 'topic' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title="Dictate topic"
            >
              <i className="fas fa-microphone"></i>
            </button>
            <button
              onClick={handleInitialGeneration}
              disabled={isGenerating || !topic}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-5 rounded-2xl transition-all flex items-center gap-3 disabled:opacity-50 h-14"
            >
              {isGenerating ? (
                <><i className="fas fa-circle-notch fa-spin"></i> Building Syllabus...</>
              ) : (
                <><i className="fas fa-sparkles"></i> Build Course</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeLesson = selectedLesson 
    ? course.modules.find(m => m.id === selectedLesson.moduleId)?.lessons.find(l => l.id === selectedLesson.lessonId)
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden -mx-4 -my-10">
      {/* Tool Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors"><i className="fas fa-times text-xl"></i></button>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <input 
                type="text" 
                value={course.title} 
                onChange={(e) => setCourse({...course, title: e.target.value})}
                className="text-lg font-bold text-gray-900 leading-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-100 rounded px-1 w-full"
              />
              {lastSaved && (
                <div className="flex items-center gap-1.5 text-green-500 shrink-0 transition-opacity animate-in fade-in">
                  <i className="fas fa-check-circle text-[10px]"></i>
                  <span className="text-[10px] font-black uppercase tracking-widest">Saved</span>
                </div>
              )}
            </div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Syllabus Editor</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onSave(course)} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-100 transition-all active:scale-95">
            Publish & Exit
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto p-4 space-y-4">
          <div className="px-2 mb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Course Outline</h3>
          </div>

          {course.modules.map((module) => (
            <div key={module.id} className="space-y-1">
              <div className="px-2 py-2">
                <input 
                  type="text"
                  value={module.title}
                  onChange={(e) => {
                    setCourse({
                      ...course,
                      modules: course.modules.map(m => m.id === module.id ? { ...m, title: e.target.value } : m)
                    });
                  }}
                  className="font-bold text-gray-900 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-100 rounded px-1 w-full"
                />
              </div>
              <div className="space-y-1">
                {module.lessons.map((lesson) => {
                  const isSelected = selectedLesson?.lessonId === lesson.id;
                  const hasContent = !!(lesson.content || (lesson.quiz && lesson.quiz.length > 0) || lesson.videoUrl);
                  const isGeneratingThis = generatingLessonIds.has(lesson.id);

                  return (
                    <div 
                      key={lesson.id} 
                      onClick={() => setSelectedLesson({moduleId: module.id, lessonId: lesson.id})}
                      className={`group flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected ? 'bg-white shadow-md ring-1 ring-blue-500/20' : 'hover:bg-gray-200/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-blue-600 text-white' : hasContent ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {lesson.type === 'video' ? <i className="fas fa-play text-[10px]"></i> : 
                           lesson.type === 'quiz' ? <i className="fas fa-tasks text-[10px]"></i> : 
                           <i className="fas fa-file-alt text-[10px]"></i>}
                        </div>
                        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                          {lesson.title}
                        </span>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            generateLessonBody(module.id, lesson.id);
                          }}
                          disabled={isGeneratingThis || !!loadingStatus}
                          title={isGeneratingThis ? "Generating..." : (hasContent ? "Regenerate" : "Generate")}
                          className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shrink-0 ml-1 ${
                            isGeneratingThis 
                              ? 'bg-gray-100 text-gray-400 cursor-wait' 
                              : hasContent 
                                ? 'text-green-600 hover:bg-green-100' 
                                : 'text-blue-600 hover:bg-blue-100'
                          }`}
                        >
                          <i className={`fas ${
                            isGeneratingThis ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'
                          } text-[10px]`}></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Focus Editor Pane */}
        <div className="flex-1 overflow-y-auto bg-white">
          {activeLesson ? (
            <div className="max-w-3xl mx-auto py-16 px-8">
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">
                    {activeLesson.type} Lesson
                  </span>
                  {(activeLesson.content || (activeLesson.quiz && activeLesson.quiz.length > 0) || activeLesson.videoUrl) ? (
                    <span className="bg-green-100 text-green-600 text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">
                      AI Generated
                    </span>
                  ) : null}
                </div>
                <input 
                  type="text"
                  value={activeLesson.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setCourse({
                      ...course,
                      modules: course.modules.map(m => m.id === selectedLesson?.moduleId ? {
                        ...m,
                        lessons: m.lessons.map(l => l.id === activeLesson.id ? { ...l, title: newTitle } : l)
                      } : m)
                    });
                  }}
                  className="text-4xl font-black text-gray-900 mb-4 bg-transparent w-full focus:outline-none focus:ring-1 focus:ring-blue-100 rounded px-1"
                />
                <p className="text-gray-500 text-sm font-medium">Auto-save is active. Every edit you make is automatically preserved in your local library.</p>
              </div>

              <div className="bg-white rounded-3xl">
                {activeLesson.type === 'quiz' ? (
                  <div className="space-y-6">
                    {activeLesson.quiz && activeLesson.quiz.length > 0 ? (
                      activeLesson.quiz.map((q, idx) => (
                        <div key={idx} className="bg-gray-50 p-6 rounded-2xl border border-gray-200 relative group/q">
                          <button 
                            onClick={() => deleteQuizQuestion(selectedLesson!.moduleId, activeLesson.id, idx)}
                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover/q:opacity-100 transition-opacity"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                          
                          <div className="flex justify-between items-start mb-4 gap-4">
                            <input 
                              type="text"
                              value={q.question}
                              onChange={(e) => updateQuizQuestionText(selectedLesson!.moduleId, activeLesson.id, idx, e.target.value)}
                              className="font-bold text-gray-900 bg-transparent w-full focus:outline-none focus:ring-b border-gray-200"
                              placeholder="Type your question..."
                            />
                            {q.correctAnswers.length > 1 && (
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-1 rounded shrink-0">
                                Multi-select
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2 mb-4">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all ${
                                q.correctAnswers?.includes(oIdx) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200'
                              }`}>
                                <input 
                                  type="checkbox" 
                                  checked={q.correctAnswers?.includes(oIdx)} 
                                  onChange={() => toggleQuizAnswer(selectedLesson!.moduleId, activeLesson.id, idx, oIdx)}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <input 
                                  type="text" 
                                  value={opt} 
                                  onChange={(e) => updateOptionText(selectedLesson!.moduleId, activeLesson.id, idx, oIdx, e.target.value)}
                                  className="bg-transparent flex-1 focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                          <button 
                            onClick={() => addOption(selectedLesson!.moduleId, activeLesson.id, idx)}
                            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800"
                          >
                            <i className="fas fa-plus mr-1"></i> Add Option
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-24 text-center border-2 border-dashed border-gray-200 rounded-3xl">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <i className="fas fa-tasks text-2xl"></i>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No quiz data yet</h3>
                        <p className="text-gray-500 max-w-xs mx-auto mb-6">Use the sparkle icon in the sidebar to generate multiple-choice questions automatically.</p>
                      </div>
                    )}
                    <button 
                      onClick={() => addQuizQuestion(selectedLesson!.moduleId, activeLesson.id)}
                      className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-blue-200 hover:text-blue-500 transition-all"
                    >
                      <i className="fas fa-plus mr-2"></i> Add Question Manually
                    </button>
                  </div>
                ) : activeLesson.type === 'video' ? (
                  <div className="min-h-[400px]">
                    {activeLesson.videoUrl ? (
                      <div className="space-y-6">
                        <video 
                          src={activeLesson.videoUrl} 
                          controls 
                          className="w-full aspect-video rounded-3xl shadow-2xl bg-black"
                        />
                        <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-blue-900">Video Asset Ready</h4>
                            <p className="text-sm text-blue-700">This clip was generated using Veo Video Intelligence and auto-saved.</p>
                          </div>
                          <button 
                            onClick={() => generateLessonBody(selectedLesson!.moduleId, activeLesson.id)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-700"
                          >
                            Regenerate Clip
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-32 text-center border-2 border-dashed border-gray-200 rounded-3xl">
                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                          <i className="fas fa-video text-3xl"></i>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Video Production Engine</h3>
                        <p className="text-gray-500 max-w-xs mx-auto mb-10">Click the sparkle button in the sidebar to generate a 720p educational cinematic for this lesson.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="min-h-[400px] relative">
                    {activeLesson.content ? (
                      <div className="space-y-4">
                        <div className="relative">
                          <textarea 
                            value={activeLesson.content}
                            onChange={(e) => updateLessonContent(selectedLesson!.moduleId, activeLesson.id, e.target.value)}
                            className="w-full h-[400px] p-6 text-gray-700 font-mono text-sm bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                            placeholder="HTML content..."
                          />
                          <button 
                            onClick={() => handleVoiceInput('content')}
                            className={`absolute bottom-4 right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
                              isListening === 'content' ? 'bg-red-600 text-white animate-pulse scale-110' : 'bg-white text-gray-500 hover:text-blue-600'
                            }`}
                            title="Dictate content"
                          >
                            <i className="fas fa-microphone text-lg"></i>
                          </button>
                        </div>
                        <div className="p-8 border border-gray-100 rounded-2xl bg-white shadow-sm">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Preview Rendering</h4>
                          <div className="prose prose-blue prose-lg max-w-none text-gray-700">
                            <div dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-24 text-center border-2 border-dashed border-gray-200 rounded-3xl relative">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <i className="fas fa-feather-alt text-2xl"></i>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Drafting Space</h3>
                        <p className="text-gray-500 max-w-xs mx-auto">Click the sparkle icon next to the lesson title to write this lesson automatically, or use the microphone to dictate.</p>
                        
                        <button 
                          onClick={() => handleVoiceInput('content')}
                          className={`mt-6 mx-auto w-16 h-16 rounded-full shadow-xl flex items-center justify-center transition-all ${
                            isListening === 'content' ? 'bg-red-600 text-white animate-pulse scale-110' : 'bg-white text-blue-600 hover:bg-gray-50'
                          }`}
                        >
                          <i className="fas fa-microphone text-2xl"></i>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-3xl p-8 mb-8 shadow-sm">
                {course.thumbnail && (
                  <img src={course.thumbnail} alt="Cover" className="w-full h-48 object-cover rounded-2xl mb-6 shadow-md" />
                )}
                <h3 className="text-2xl font-black text-gray-900 mb-2">{course.title}</h3>
                <p className="text-gray-500 text-sm line-clamp-3">{course.description}</p>
              </div>
              <p className="text-gray-400 font-medium">Select a lesson from the sidebar to begin building content.</p>
            </div>
          )}
        </div>
      </div>

      {loadingStatus && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-bounce border border-gray-700">
          <i className="fas fa-circle-notch fa-spin text-blue-400"></i>
          <span className="font-bold text-sm tracking-wide uppercase">{loadingStatus}</span>
        </div>
      )}
    </div>
  );
};

export default CourseBuilder;
