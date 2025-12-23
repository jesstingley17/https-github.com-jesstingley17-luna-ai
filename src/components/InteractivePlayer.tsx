
import React, { useState, useEffect, useRef } from 'react';
import { InteractiveLesson, LessonStep } from '../types';
import { decodeBase64, decodeAudioData } from '../services/geminiService';

interface InteractivePlayerProps {
  lesson: InteractiveLesson;
  onExit: () => void;
}

const InteractivePlayer: React.FC<InteractivePlayerProps> = ({ lesson, onExit }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number[]>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Audio playback references
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const steps = lesson.steps;
  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    // Reset state and stop audio when step changes
    setIsPlaying(false);
    stopAudio();
    return () => stopAudio();
  }, [currentStepIndex, showQuiz]);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setShowQuiz(true);
    }
  };

  const handlePrev = () => {
    if (showQuiz) {
      setShowQuiz(false);
    } else if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const toggleAudio = async () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
      return;
    }

    if (!currentStep.audioData) return;

    try {
      // Initialize AudioContext if not already done
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      const bytes = decodeBase64(currentStep.audioData);
      const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
      
      stopAudio();
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
      audioSourceRef.current = source;
      setIsPlaying(true);
    } catch (err) {
      console.error("Interactive audio playback failed:", err);
    }
  };

  const toggleAnswer = (qIdx: number, oIdx: number) => {
    if (quizSubmitted) return;
    setUserAnswers(prev => {
      const current = prev[qIdx] || [];
      const updated = current.includes(oIdx)
        ? current.filter(i => i !== oIdx)
        : [...current, oIdx];
      return { ...prev, [qIdx]: updated };
    });
  };

  const score = quizSubmitted 
    ? lesson.quiz.reduce((acc, q, idx) => {
        const answers = userAnswers[idx] || [];
        const isCorrect = answers.length === q.correctAnswers.length && 
                          answers.every(a => q.correctAnswers.includes(a));
        return acc + (isCorrect ? 1 : 0);
      }, 0)
    : 0;

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 border-b border-gray-100 flex items-center justify-between px-6 shrink-0 bg-white">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
            <i className="fas fa-times"></i>
          </button>
          <div className="h-6 w-px bg-gray-100"></div>
          <div>
            <h1 className="text-sm font-black text-gray-900 uppercase tracking-widest">{lesson.topic}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
              {showQuiz ? 'Final Assessment' : `Step ${currentStepIndex + 1} of ${steps.length}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!showQuiz && steps.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                idx === currentStepIndex ? 'w-8 bg-blue-600' : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="max-w-6xl mx-auto h-full">
          {!showQuiz ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full items-center">
              {/* Illustration Side */}
              <div className="relative aspect-video lg:aspect-square bg-gray-50 rounded-[40px] overflow-hidden shadow-2xl shadow-blue-50 border-8 border-white group">
                {currentStep.imageUrl ? (
                  <img 
                    src={currentStep.imageUrl} 
                    alt={currentStep.title} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                    <i className="fas fa-image text-6xl mb-4"></i>
                    <p className="font-bold uppercase tracking-widest text-xs">Illustration missing</p>
                  </div>
                )}
                
                {currentStep.audioData && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                    <button 
                      onClick={toggleAudio}
                      className="w-16 h-16 bg-white shadow-2xl rounded-full flex items-center justify-center text-blue-600 hover:scale-110 transition-transform active:scale-95"
                    >
                      <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play text-xl ml-1'}`}></i>
                    </button>
                  </div>
                )}
              </div>

              {/* Text Side */}
              <div className="space-y-8 animate-in fade-in slide-in-from-right duration-700">
                <div className="inline-block px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                  Step {currentStepIndex + 1}: Learning Objective
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight">
                  {currentStep.title}
                </h2>
                <p className="text-xl text-gray-600 leading-relaxed font-medium">
                  {currentStep.explanation}
                </p>
                
                <div className="space-y-4 pt-6">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Key Takeaways</h4>
                  <ul className="grid gap-3">
                    {currentStep.keyPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                          <i className="fas fa-check text-[10px]"></i>
                        </div>
                        <span className="text-sm font-bold text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-12">
              <div className="text-center mb-16">
                <div className="inline-block p-4 bg-yellow-50 text-yellow-600 rounded-3xl mb-6">
                  <i className="fas fa-trophy text-3xl"></i>
                </div>
                <h2 className="text-4xl font-black text-gray-900 mb-4">Time to test your skills!</h2>
                <p className="text-gray-500 font-medium">Show what you've learned about "{lesson.topic}"</p>
              </div>

              <div className="space-y-12">
                {lesson.quiz.map((q, qIdx) => (
                  <div key={qIdx} className="bg-gray-50 p-8 rounded-[40px] border border-gray-200">
                    <p className="text-2xl font-black text-gray-900 mb-8">{qIdx + 1}. {q.question}</p>
                    <div className="grid gap-4">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = userAnswers[qIdx]?.includes(oIdx);
                        const isCorrect = q.correctAnswers.includes(oIdx);
                        let style = "bg-white border-2 border-transparent shadow-sm";
                        
                        if (quizSubmitted) {
                          if (isCorrect) style = "bg-green-50 border-green-500 text-green-700";
                          else if (isSelected) style = "bg-red-50 border-red-500 text-red-700";
                        } else if (isSelected) {
                          style = "bg-blue-50 border-blue-500 text-blue-700 shadow-blue-50 shadow-xl";
                        }

                        return (
                          <button 
                            key={oIdx} 
                            disabled={quizSubmitted}
                            onClick={() => toggleAnswer(qIdx, oIdx)}
                            className={`w-full text-left p-6 rounded-3xl font-bold transition-all flex items-center gap-4 ${style}`}
                          >
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200'}`}>
                              {isSelected && <i className="fas fa-check text-white text-[10px]"></i>}
                            </div>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-16 text-center">
                {!quizSubmitted ? (
                  <button 
                    onClick={() => setQuizSubmitted(true)}
                    className="bg-gray-900 text-white px-16 py-5 rounded-[32px] font-black text-xl hover:bg-black shadow-2xl shadow-gray-200 transition-all active:scale-95"
                  >
                    Finish Assessment
                  </button>
                ) : (
                  <div className="bg-blue-600 text-white p-12 rounded-[50px] shadow-2xl shadow-blue-100 flex flex-col items-center">
                    <div className="text-6xl font-black mb-4">{score}/{lesson.quiz.length}</div>
                    <div className="text-xl font-bold opacity-80 mb-8">Great effort on "{lesson.topic}"!</div>
                    <button 
                      onClick={onExit}
                      className="bg-white text-blue-600 px-12 py-4 rounded-2xl font-black hover:bg-gray-50 transition-colors"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="h-24 border-t border-gray-100 flex items-center justify-between px-10 shrink-0 bg-white">
        <button 
          onClick={handlePrev}
          disabled={!showQuiz && currentStepIndex === 0}
          className="flex items-center gap-3 text-gray-400 hover:text-gray-900 font-black text-xs uppercase tracking-widest disabled:opacity-10 transition-all"
        >
          <i className="fas fa-arrow-left"></i> Back
        </button>

        {!showQuiz && (
          <button 
            onClick={handleNext}
            className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center gap-3"
          >
            {currentStepIndex === steps.length - 1 ? 'Start Quiz' : 'Continue'} <i className="fas fa-arrow-right"></i>
          </button>
        )}
      </footer>
    </div>
  );
};

export default InteractivePlayer;
