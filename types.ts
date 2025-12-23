
export interface LessonStep {
  id: string;
  title: string;
  explanation: string;
  keyPoints: string[];
  imagePrompt: string;
  imageUrl?: string;
  audioData?: string;
}

export interface InteractiveLesson {
  id: string;
  topic: string;
  steps: LessonStep[];
  quiz: QuizQuestion[];
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'video' | 'quiz' | 'interactive';
  videoUrl?: string;
  imageUrl?: string;
  quiz?: QuizQuestion[];
  interactiveData?: InteractiveLesson;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswers: number[];
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  modules: Module[];
  teaserVideoUrl?: string;
}

export interface AnalyticsData {
  date: string;
  completions: number;
  engagement: number;
}
