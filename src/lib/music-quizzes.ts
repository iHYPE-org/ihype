/** Curated, fact-checked questions. Do not send correct answers to the browser before submission. */
export const MUSIC_QUIZZES = [{
  id: 'music-trivia-001',
  title: 'Music Trivia: First Edition',
  questions: [
    { id: 'q1', text: 'Which instrument typically has 88 keys?', options: ['Piano', 'Violin', 'Trumpet', 'Flute'], correct: 0, explanation: 'A standard modern piano keyboard has 88 keys.' },
    { id: 'q2', text: 'What does BPM stand for in music?', options: ['Bass per measure', 'Beats per minute', 'Bars per melody', 'Beats per melody'], correct: 1, explanation: 'BPM measures tempo in beats per minute.' },
    { id: 'q3', text: 'Which family of instruments includes the saxophone?', options: ['Brass', 'Strings', 'Woodwind', 'Percussion'], correct: 2, explanation: 'The saxophone is a woodwind because its sound comes from a reed.' },
    { id: 'q4', text: 'How many semitones are in one octave in standard Western equal temperament?', options: ['8', '10', '12', '14'], correct: 2, explanation: 'An octave spans 12 equal-tempered semitones.' },
    { id: 'q5', text: 'What is the name for a song performed without instrumental accompaniment?', options: ['Legato', 'A cappella', 'Staccato', 'Arpeggio'], correct: 1, explanation: 'A cappella means singing without instrumental accompaniment.' },
  ],
}] as const;
export function findMusicQuiz(id: string) { return MUSIC_QUIZZES.find((quiz) => quiz.id === id); }
