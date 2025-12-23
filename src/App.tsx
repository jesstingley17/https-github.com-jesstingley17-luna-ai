
import React, { useState, useEffect } from 'react';
import { Course, InteractiveLesson } from './types';
import CourseBuilder from './components/CourseBuilder';
import LMSPlayer from './components/LMSPlayer';
import InteractivePlayer from './components/InteractivePlayer';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { generateInteractiveLessonStructure, generateIllustration, generateNarration } from './services/geminiService';

const dummyStats = [
  { name: 'Mon', learners: 400 },
  { name: 'Tue', learners: 300 },
  { name: 'Wed', learners: 200 },
  { name: 'Thu', learners: 278 },
  { name: 'Fri', learners: 189 },
  { name: 'Sat', learners: 239 },
  { name: 'Sun', learners: 349 },
];

const App: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'learn' | 'edit' | 'interactive_gen' | 'interactive_play'>('dashboard');
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [interactiveLesson, setInteractiveLesson] = useState<InteractiveLesson | null>(null);
  const [isGeneratingInteractive, setIsGeneratingInteractive] = useState(false);
  const [interactiveTopic, setInteractiveTopic] = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('edugenius_courses');
    if (saved) setCourses(JSON.parse(saved));
  }, []);

  const saveCourse = (course: Course) => {
    setCourses(prev => {
      const exists = prev.find(c => c.id === course.id);
      let updated;
      if (exists) {
        updated = prev.map(c => c.id === course.id ? course : c);
      } else {
        updated = [...prev, course];
      }
      localStorage.setItem('edugenius_courses', JSON.stringify(updated));
      return updated;
    });
    setCurrentView('dashboard');
  };

  const deleteCourse = (id: string) => {
    if(!confirm("Are you sure you want to delete this course?")) return;
    const updated = courses.filter(c => c.id !== id);
    setCourses(updated);
    localStorage.setItem('edugenius_courses', JSON.stringify(updated));
  };

  // Fixed missing startEditing function
  const startEditing = (course: Course) => {
    setActiveCourse(course);
    setCurrentView('edit');
  };

  const startInteractiveGeneration = async () => {
    if (!interactiveTopic) return;
    setIsGeneratingInteractive(true);
    setGenProgress(10);
    setGenStatus('Brainstorming sequence...');
    
    try {
      const lesson = await generateInteractiveLessonStructure(interactiveTopic);
      setGenProgress(40);
      setGenStatus('Architecting visuals and audio...');
      
      const stepsWithAssets = [];
      for (let i = 0; i < lesson.steps.length; i++) {
        const step = lesson.steps[i];
        setGenStatus(`Step ${i + 1}: Generating illustration...`);
        const imageUrl = await generateIllustration(step.imagePrompt);
        
        setGenStatus(`Step ${i + 1}: Synthesizing voice explanation...`);
        const audioData = await generateNarration(step.explanation);
        
        stepsWithAssets.push({ ...step, imageUrl, audioData });
        setGenProgress(40 + (i + 1) * (60 / lesson.steps.length));
      }

      setInteractiveLesson({ ...lesson, steps: stepsWithAssets });
      setCurrentView('interactive_play');
    } catch (error) {
      console.error(error);
      alert('Generation failed. Please try a different topic.');
    } finally {
      setIsGeneratingInteractive(false);
      setGenProgress(0);
      setGenStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Universal Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 px-6">
        <div className="max-w-7xl mx-auto h-20 flex justify-between items-center">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100 rotate-3">
              <i className="fas fa-graduation-cap text-2xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tighter leading-none">EduGenius</h1>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Creator Edition</span>
            </div>
          </div>
          
          <div className="flex items-center gap-10">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`text-sm font-bold uppercase tracking-widest ${currentView === 'dashboard' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}`}
            >
              My Library
            </button>
            <button 
              onClick={() => {
                setActiveCourse(null);
                setCurrentView('create');
              }}
              className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center gap-2"
            >
              <i className="fas fa-plus"></i> New Course
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {currentView === 'dashboard' && (
          <div className="space-y-16">
            {/* Quick Interactive Tool */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[40px] p-12 text-white shadow-3xl shadow-blue-100 relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <h2 className="text-4xl font-black mb-4 tracking-tight">Interactive Lesson Player</h2>
                <p className="text-blue-100 text-lg font-medium mb-10">Generate a step-by-step interactive learning sequence with AI narrations, illustrations, and a quiz in one click.</p>
                
                <div className="flex gap-4 p-2 bg-white/10 backdrop-blur rounded-[30px] border border-white/20">
                  <input 
                    type="text" 
                    placeholder="e.g. How many sides does a triangle have?"
                    className="flex-1 bg-transparent px-6 py-4 text-white placeholder-blue-200 focus:outline-none font-bold"
                    value={interactiveTopic}
                    onChange={(e) => setInteractiveTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && startInteractiveGeneration()}
                  />
                  <button 
                    onClick={startInteractiveGeneration}
                    disabled={isGeneratingInteractive || !interactiveTopic}
                    className="bg-white text-blue-600 px-10 py-4 rounded-[24px] font-black hover:bg-blue-50 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {isGeneratingInteractive ? (
                      <><i className="fas fa-circle-notch fa-spin"></i> Creating...</>
                    ) : (
                      <><i className="fas fa-wand-magic-sparkles"></i> Generate Lesson</>
                    )}
                  </button>
                </div>
                
                {isGeneratingInteractive && (
                  <div className="mt-8 space-y-4">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-blue-200">
                      <span>{genStatus}</span>
                      <span>{Math.round(genProgress)}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white transition-all duration-500" style={{ width: `${genProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
              <i className="fas fa-sparkles absolute -bottom-10 -right-10 text-[240px] opacity-10 rotate-12"></i>
            </div>

            {/* Library Section */}
            <div>
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">My Courses</h2>
                  <p className="text-gray-500 font-medium">Full curriculum courses generated by Gemini.</p>
                </div>
              </div>

              {courses.length === 0 ? (
                <div className="py-24 bg-gray-50 border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center text-center px-6">
                  <i className="fas fa-book-open text-4xl text-gray-200 mb-6"></i>
                  <h3 className="text-xl font-black text-gray-900 mb-2">No courses yet</h3>
                  <button onClick={() => setCurrentView('create')} className="text-blue-600 font-black uppercase tracking-widest text-xs mt-2 hover:underline">Build one now</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {courses.map(course => (
                    <div key={course.id} className="group bg-white rounded-[32px] border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500">
                      <div className="h-60 relative overflow-hidden">
                        {course.thumbnail ? (
                          <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                            <i className="fas fa-mountain text-5xl text-blue-200"></i>
                          </div>
                        )}
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); startEditing(course); }} className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm">
                            <i className="fas fa-edit text-sm"></i>
                          </button>
                           <button onClick={(e) => { e.stopPropagation(); deleteCourse(course.id); }} className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm">
                            <i className="fas fa-trash-alt text-sm"></i>
                          </button>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                          <h3 className="text-white font-black text-xl leading-tight">{course.title}</h3>
                        </div>
                      </div>
                      <div className="p-8">
                        <button 
                          onClick={() => { setActiveCourse(course); setCurrentView('learn'); }}
                          className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:shadow-lg group-hover:shadow-blue-100"
                        >
                          Launch Course <i className="fas fa-rocket text-xs opacity-50"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 border-t border-gray-100 pt-16">
              <div className="bg-gray-50 p-10 rounded-[40px]">
                <h3 className="text-xl font-black mb-8">Learning Trends</h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dummyStats}>
                      <Area type="monotone" dataKey="learners" stroke="#2563eb" fill="#dbeafe" strokeWidth={4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex flex-col justify-center px-10">
                <div className="space-y-10">
                  <div className="flex gap-6">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center shrink-0">
                      <i className="fas fa-bolt text-2xl"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-lg">Instant Lessons</h4>
                      <p className="text-gray-500">Break down any topic into an interactive visual story in seconds.</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-3xl flex items-center justify-center shrink-0">
                      <i className="fas fa-microphone text-2xl"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-lg">AI Narration</h4>
                      <p className="text-gray-500">Every lesson step is automatically narrated for better retention.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(currentView === 'create' || currentView === 'edit') && (
          <CourseBuilder 
            initialCourse={activeCourse || undefined}
            onSave={saveCourse} 
            onCancel={() => setCurrentView('dashboard')} 
          />
        )}

        {currentView === 'learn' && activeCourse && (
          <LMSPlayer 
            course={activeCourse} 
            onExit={() => setCurrentView('dashboard')} 
          />
        )}

        {currentView === 'interactive_play' && interactiveLesson && (
          <InteractivePlayer 
            lesson={interactiveLesson} 
            onExit={() => setCurrentView('dashboard')} 
          />
        )}
      </main>
    </div>
  );
};

export default App;
