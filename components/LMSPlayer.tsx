
import React, { useState, useEffect, useRef } from 'react';
import { Course, Lesson } from '../types';
import { generateNarration, decodeBase64, decodeAudioData } from '../services/geminiService';

interface LMSPlayerProps {
  course: Course;
  onExit: () => void;
}

const LMSPlayer: React.FC<LMSPlayerProps> = ({ course, onExit }) => {
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [isNarrating, setIsNarrating] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number[]>>({});
  const [showResults, setShowResults] = useState(false);
  
  // Audio playback management
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (course.modules[activeModuleIndex]?.lessons[activeLessonIndex]) {
      setCurrentLesson(course.modules[activeModuleIndex].lessons[activeLessonIndex]);
      setUserAnswers({});
      setShowResults(false);
      stopNarration();
    }
    return () => stopNarration();
  }, [activeModuleIndex, activeLessonIndex, course]);

  const stopNarration = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
  };

  const handleNext = () => {
    const currentModule = course.modules[activeModuleIndex];
    if (activeLessonIndex < currentModule.lessons.length - 1) {
      setActiveLessonIndex(activeLessonIndex + 1);
    } else if (activeModuleIndex < course.modules.length - 1) {
      setActiveModuleIndex(activeModuleIndex + 1);
      setActiveLessonIndex(0);
    }
  };

  const handlePrev = () => {
    if (activeLessonIndex > 0) {
      setActiveLessonIndex(activeLessonIndex - 1);
    } else if (activeModuleIndex > 0) {
      const prevModuleIndex = activeModuleIndex - 1;
      setActiveModuleIndex(prevModuleIndex);
      setActiveLessonIndex(course.modules[prevModuleIndex].lessons.length - 1);
    }
  };

  const playNarration = async () => {
    if (!currentLesson?.content) return;
    setIsNarrating(true);
    try {
      const base64 = await generateNarration(currentLesson.content);
      
      // Initialize AudioContext if not already done
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      const bytes = decodeBase64(base64);
      const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
      
      stopNarration();
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsNarrating(false);
      source.start();
      audioSourceRef.current = source;
      
    } catch (error) {
      console.error("Narration playback failed:", error);
      setIsNarrating(false);
    }
  };

  const toggleAnswer = (qIdx: number, oIdx: number) => {
    if (showResults) return;
    setUserAnswers(prev => {
      const current = prev[qIdx] || [];
      const updated = current.includes(oIdx)
        ? current.filter(i => i !== oIdx)
        : [...current, oIdx];
      return { ...prev, [qIdx]: updated };
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto shrink-0">
        <div className="p-6 border-b border-gray-200 bg-white sticky top-0 z-10">
          <button onClick={onExit} className="text-gray-500 hover:text-gray-900 mb-4 flex items-center gap-2 font-bold text-sm uppercase tracking-widest">
            <i className="fas fa-arrow-left"></i> Exit Player
          </button>
          <h1 className="text-xl font-black text-gray-900 leading-tight">{course.title}</h1>
        </div>
        <div className="p-4">
          {course.modules.map((module, mIdx) => (
            <div key={module.id} className="mb-6">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Module {mIdx + 1}: {module.title}</h3>
              <div className="space-y-1">
                {module.lessons.map((lesson, lIdx) => {
                  const isActive = activeModuleIndex === mIdx && activeLessonIndex === lIdx;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => { setActiveModuleIndex(mIdx); setActiveLessonIndex(lIdx); }}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${
                        isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {lesson.type === 'video' ? <i className="fas fa-play-circle"></i> : 
                       lesson.type === 'quiz' ? <i className="fas fa-tasks"></i> : 
                       <i className="fas fa-file-alt"></i>}
                      <span className="text-sm font-bold truncate">{lesson.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-4xl mx-auto py-16 px-8">
          {currentLesson ? (
            <>
              <div className="flex justify-between items-center mb-10 pb-6 border-b border-gray-100">
                <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                  Level {activeModuleIndex + 1} / Lesson {activeLessonIndex + 1} • {currentLesson.type}
                </span>
                {currentLesson.type === 'text' && (
                  <button 
                    onClick={playNarration}
                    className="flex items-center gap-2 bg-gray-900 text-white text-xs px-4 py-2 rounded-full font-bold hover:bg-black disabled:opacity-50 shadow-lg"
                    disabled={isNarrating || !currentLesson.content}
                  >
                    <i className={`fas ${isNarrating ? 'fa-circle-notch fa-spin' : 'fa-volume-up'}`}></i>
                    AI Narrator
                  </button>
                )}
              </div>

              <h2 className="text-5xl font-black text-gray-900 mb-12 tracking-tight leading-tight">{currentLesson.title}</h2>
              
              <div className="mb-20">
                {currentLesson.type === 'quiz' ? (
                  <div className="space-y-8">
                    {currentLesson.quiz?.map((q, qIdx) => (
                      <div key={qIdx} className={`p-8 rounded-3xl border transition-all ${showResults ? 'bg-white' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex justify-between items-start mb-6">
                          <p className="text-xl font-bold text-gray-900">{qIdx + 1}. {q.question}</p>
                          {q.correctAnswers.length > 1 && (
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">Multiple Selection</span>
                          )}
                        </div>
                        <div className="space-y-3">
                          {q.options.map((opt, oIdx) => {
                            const isSelected = userAnswers[qIdx]?.includes(oIdx);
                            const isCorrect = q.correctAnswers.includes(oIdx);
                            let borderColor = 'border-transparent';
                            let statusIcon = null;

                            if (showResults) {
                              if (isCorrect) {
                                borderColor = 'border-green-500 bg-green-50 ring-1 ring-green-100';
                                statusIcon = <i className="fas fa-check-circle text-green-600"></i>;
                              } else if (isSelected && !isCorrect) {
                                borderColor = 'border-red-500 bg-red-50 ring-1 ring-red-100';
                                statusIcon = <i className="fas fa-times-circle text-red-600"></i>;
                              }
                            } else if (isSelected) {
                              borderColor = 'border-blue-500 bg-blue-50 ring-1 ring-blue-100';
                            }

                            return (
                              <button 
                                key={oIdx} 
                                onClick={() => toggleAnswer(qIdx, oIdx)}
                                className={`w-full text-left p-5 bg-white border-2 rounded-2xl hover:shadow-xl transition-all font-semibold text-gray-700 shadow-sm flex items-center gap-4 ${borderColor}`}
                              >
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'border-gray-200'}`}>
                                  {isSelected && <i className="fas fa-check text-white text-[10px]"></i>}
                                </div>
                                <span className="flex-1">{opt}</span>
                                {statusIcon}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!showResults ? (
                      <button 
                        onClick={() => setShowResults(true)}
                        className="w-full bg-gray-900 text-white py-6 rounded-3xl font-black text-xl hover:bg-black shadow-2xl transition-all transform active:scale-[0.98]"
                      >
                        Submit Assessment
                      </button>
                    ) : (
                      <button 
                        onClick={() => {setShowResults(false); setUserAnswers({});}}
                        className="w-full bg-white text-gray-900 border-2 border-gray-200 py-6 rounded-3xl font-black text-xl hover:bg-gray-50 shadow-xl transition-all transform active:scale-[0.98]"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                ) : currentLesson.type === 'video' ? (
                  <div className="space-y-12">
                    {currentLesson.videoUrl ? (
                      <div className="bg-black rounded-[40px] overflow-hidden shadow-2xl shadow-blue-100 border-8 border-white aspect-video relative group">
                        <video 
                          src={currentLesson.videoUrl} 
                          controls 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video rounded-[40px] bg-gray-100 flex flex-col items-center justify-center text-center p-12 border-4 border-dashed border-gray-200">
                        <i className="fas fa-video-slash text-5xl text-gray-300 mb-6"></i>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">No Video Preview</h3>
                        <p className="text-gray-500 max-w-sm">The creator hasn't generated a video for this lesson yet.</p>
                      </div>
                    )}
                    <div className="prose prose-blue prose-lg max-w-none text-gray-600 italic">
                      Video content designed to explain the key concepts of "{currentLesson.title}" visually.
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-blue prose-2xl max-w-none text-gray-800 leading-relaxed">
                    <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <div className="flex justify-between items-center pt-12 border-t border-gray-100 mt-24">
                <button 
                  onClick={handlePrev}
                  disabled={activeModuleIndex === 0 && activeLessonIndex === 0}
                  className="flex items-center gap-2 text-gray-400 hover:text-gray-900 font-black text-sm uppercase tracking-widest disabled:opacity-10 transition-colors"
                >
                  <i className="fas fa-chevron-left"></i> Previous
                </button>
                <div className="hidden md:block text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
                   {course.title} • Lesson {activeLessonIndex + 1}
                </div>
                <button 
                  onClick={handleNext}
                  disabled={activeModuleIndex === course.modules.length - 1 && activeLessonIndex === course.modules[course.modules.length - 1].lessons.length - 1}
                  className="flex items-center gap-2 bg-blue-600 text-white px-10 py-4 rounded-2xl hover:bg-blue-700 font-black shadow-2xl shadow-blue-100 disabled:opacity-10 transform transition-all active:scale-95"
                >
                  Next Lesson <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-40 text-gray-400">
              <i className="fas fa-book-open text-6xl mb-6 opacity-20"></i>
              <p className="font-bold uppercase tracking-widest">Select a module to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LMSPlayer;
