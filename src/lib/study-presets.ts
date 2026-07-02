import type { FlashcardSet, Quiz } from '../types';
import type { MathSolverResponse } from '../services/gemini';

export type StudySuggestionFeature = 'flashcards' | 'quizzes' | 'math';

const HISTORY_LIMIT = 24;

function historyKey(feature: StudySuggestionFeature, userId?: string | null) {
  return `edurev-${feature}-suggestions-${userId || 'guest'}`;
}

export function normalizeStudyTopic(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function readHistory(feature: StudySuggestionFeature, userId?: string | null) {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(historyKey(feature, userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeHistory(feature: StudySuggestionFeature, userId: string | null | undefined, entries: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(historyKey(feature, userId), JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
  } catch {
    // Ignore local storage failures.
  }
}

export function recordStudySuggestionUsage(feature: StudySuggestionFeature, topic: string, userId?: string | null) {
  const cleaned = topic.trim();
  if (!cleaned) return;
  const existing = readHistory(feature, userId).filter((item) => normalizeStudyTopic(item) !== normalizeStudyTopic(cleaned));
  writeHistory(feature, userId, [cleaned, ...existing]);
}

const DEFAULT_FLASHCARD_SUGGESTIONS = [
  'Photosynthesis',
  'Ancient Rome',
  'Algebra Help',
  'Climate Change',
  'Shakespeare',
  'Coding Basics',
  'Cell Structure',
  'Demand and Supply',
  'Periodic Table',
  'Essay Vocabulary',
];

const DEFAULT_QUIZ_SUGGESTIONS = [
  'Photosynthesis',
  'Ancient Rome',
  'Algebra Help',
  'Climate Change',
  'Shakespeare',
  'Coding Basics',
  'Probability',
  'World War I',
  'Macroeconomics',
  'Human Anatomy',
];

const DEFAULT_MATH_SUGGESTIONS = [
  'Solve 2x^2 - 5x - 3 = 0',
  'Differentiate f(x)=x^3 sin(x)',
  'Integrate (3x^2 + 4x - 1) dx',
  'Find the limit as x -> 0 of sin(5x)/x',
  'Solve the system: 2x + y = 7, x - y = 2',
  'Expand and simplify (x + 3)(x - 5)',
  'Find the derivative of x^2 + 4x + 1',
  'Solve 3x - 7 = 11',
];

export function getStudySuggestions(feature: StudySuggestionFeature, userId?: string | null) {
  const defaults =
    feature === 'flashcards'
      ? DEFAULT_FLASHCARD_SUGGESTIONS
      : feature === 'quizzes'
        ? DEFAULT_QUIZ_SUGGESTIONS
        : DEFAULT_MATH_SUGGESTIONS;

  const seen = new Set<string>();
  return [...readHistory(feature, userId), ...defaults].filter((item) => {
    const key = normalizeStudyTopic(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const FLASHCARD_PRESET_LIBRARY: Record<string, Omit<FlashcardSet, 'id' | 'userId' | 'createdAt'>> = {
  [normalizeStudyTopic('Photosynthesis')]: {
    title: 'Photosynthesis',
    description: 'Pregenerated revision flashcards for photosynthesis.',
    cards: [
      { term: 'Photosynthesis', definition: 'The process plants use to convert light energy into chemical energy stored as glucose.' },
      { term: 'Reactants', definition: 'Carbon dioxide, water, and light energy are required for photosynthesis.' },
      { term: 'Products', definition: 'Glucose and oxygen are produced during photosynthesis.' },
      { term: 'Chlorophyll', definition: 'The green pigment in chloroplasts that absorbs light energy.' },
      { term: 'Chloroplast', definition: 'The plant cell organelle where photosynthesis takes place.' },
      { term: 'Word equation', definition: 'Carbon dioxide + water -> glucose + oxygen.' },
      { term: 'Light-dependent reactions', definition: 'The stage that captures light energy and splits water.' },
      { term: 'Calvin cycle', definition: 'The stage that uses carbon dioxide to build glucose.' },
      { term: 'Stomata', definition: 'Tiny pores that allow carbon dioxide to enter leaves.' },
      { term: 'Limiting factors', definition: 'Light intensity, carbon dioxide concentration, and temperature can limit the rate of photosynthesis.' },
    ],
  },
  [normalizeStudyTopic('Ancient Rome')]: {
    title: 'Ancient Rome',
    description: 'Pregenerated revision flashcards for Ancient Rome.',
    cards: [
      { term: 'Republic', definition: 'The period when Rome was governed by elected officials and the Senate.' },
      { term: 'Empire', definition: 'The period when Rome was ruled by emperors after Julius Caesar and Augustus.' },
      { term: 'Senate', definition: 'A powerful political body that advised magistrates and influenced Roman policy.' },
      { term: 'Pax Romana', definition: 'A long era of peace and stability across the Roman Empire.' },
      { term: 'Legion', definition: 'A major unit of the Roman army made up of trained soldiers.' },
      { term: 'Julius Caesar', definition: 'A general and statesman whose rise helped end the Roman Republic.' },
      { term: 'Augustus', definition: 'Rome’s first emperor and the founder of the Roman Empire.' },
      { term: 'Aqueduct', definition: 'An engineering system that transported water into Roman cities.' },
      { term: 'Forum', definition: 'The public square used for politics, business, and social life.' },
      { term: 'Fall of Rome', definition: 'The decline of the Western Roman Empire is commonly dated to 476 CE.' },
    ],
  },
  [normalizeStudyTopic('Algebra Help')]: {
    title: 'Algebra Help',
    description: 'Pregenerated revision flashcards for algebra fundamentals.',
    cards: [
      { term: 'Variable', definition: 'A symbol, usually a letter, that represents an unknown number.' },
      { term: 'Coefficient', definition: 'The number multiplying a variable, such as 3 in 3x.' },
      { term: 'Like terms', definition: 'Terms with the same variable and power that can be combined.' },
      { term: 'Expand', definition: 'To multiply brackets out into individual terms.' },
      { term: 'Factorise', definition: 'To rewrite an expression as a product of simpler expressions.' },
      { term: 'Linear equation', definition: 'An equation whose highest variable power is 1.' },
      { term: 'Quadratic equation', definition: 'An equation whose highest variable power is 2.' },
      { term: 'Substitution', definition: 'Replacing a variable with a known value or expression.' },
      { term: 'Solve', definition: 'To find the value of the variable that makes the equation true.' },
      { term: 'Inverse operations', definition: 'Operations used to undo another operation, like division undoing multiplication.' },
    ],
  },
  [normalizeStudyTopic('Climate Change')]: {
    title: 'Climate Change',
    description: 'Pregenerated revision flashcards for climate change.',
    cards: [
      { term: 'Climate change', definition: 'Long-term shifts in global or regional temperatures and weather patterns.' },
      { term: 'Greenhouse gases', definition: 'Gases such as carbon dioxide and methane that trap heat in the atmosphere.' },
      { term: 'Carbon footprint', definition: 'The total greenhouse gas emissions caused by a person, product, or activity.' },
      { term: 'Renewable energy', definition: 'Energy from sources that naturally replenish, like solar and wind.' },
      { term: 'Sea-level rise', definition: 'An increase in average ocean level caused by warming and melting ice.' },
      { term: 'Mitigation', definition: 'Actions taken to reduce climate change by lowering emissions.' },
      { term: 'Adaptation', definition: 'Changes made to cope with climate impacts that are already happening.' },
      { term: 'Deforestation', definition: 'The clearing of forests, which reduces carbon storage and increases emissions.' },
      { term: 'Paris Agreement', definition: 'An international agreement aimed at limiting global warming.' },
      { term: 'Extreme weather', definition: 'Heatwaves, floods, and storms that can become more intense with climate change.' },
    ],
  },
  [normalizeStudyTopic('Shakespeare')]: {
    title: 'Shakespeare',
    description: 'Pregenerated revision flashcards for Shakespeare studies.',
    cards: [
      { term: 'William Shakespeare', definition: 'An English playwright and poet from the late 16th and early 17th centuries.' },
      { term: 'Tragedy', definition: 'A play form ending in downfall or death, such as Hamlet or Macbeth.' },
      { term: 'Comedy', definition: 'A play form featuring confusion, humour, and a positive ending.' },
      { term: 'Soliloquy', definition: 'A speech in which a character reveals inner thoughts alone on stage.' },
      { term: 'Iambic pentameter', definition: 'A rhythm of five unstressed-stressed beats often used in Shakespeare’s verse.' },
      { term: 'Theme', definition: 'A main idea in a text, such as ambition, love, jealousy, or power.' },
      { term: 'Dramatic irony', definition: 'When the audience knows something a character does not.' },
      { term: 'Macbeth', definition: 'A tragedy focused on ambition, guilt, and the abuse of power.' },
      { term: 'Romeo and Juliet', definition: 'A tragedy centered on love, family conflict, and fate.' },
      { term: 'Context', definition: 'The social and historical background that shapes the play and its meanings.' },
    ],
  },
  [normalizeStudyTopic('Coding Basics')]: {
    title: 'Coding Basics',
    description: 'Pregenerated revision flashcards for coding basics.',
    cards: [
      { term: 'Algorithm', definition: 'A step-by-step process for solving a problem.' },
      { term: 'Variable', definition: 'A named storage location for data in a program.' },
      { term: 'Function', definition: 'A reusable block of code that performs a task.' },
      { term: 'Loop', definition: 'A control structure that repeats code.' },
      { term: 'Conditional', definition: 'Code that makes decisions using conditions like if or else.' },
      { term: 'Array', definition: 'A structure that stores multiple values in order.' },
      { term: 'Bug', definition: 'An error in code that causes incorrect behaviour.' },
      { term: 'Syntax', definition: 'The rules that define how code must be written.' },
      { term: 'Debugging', definition: 'The process of finding and fixing problems in code.' },
      { term: 'Output', definition: 'The result produced by a program.' },
    ],
  },
};

const QUIZ_PRESET_LIBRARY: Record<string, Omit<Quiz, 'id' | 'userId' | 'createdAt'>> = {
  [normalizeStudyTopic('Photosynthesis')]: {
    title: 'Photosynthesis',
    questions: [
      { question: 'What gas do plants absorb for photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctAnswer: 'Carbon dioxide', explanation: 'Plants absorb carbon dioxide from the air through stomata.' },
      { question: 'Which organelle is the main site of photosynthesis?', options: ['Nucleus', 'Chloroplast', 'Mitochondrion', 'Ribosome'], correctAnswer: 'Chloroplast', explanation: 'Chloroplasts contain chlorophyll and host the reactions of photosynthesis.' },
      { question: 'Which pigment captures light energy?', options: ['Haemoglobin', 'Melanin', 'Chlorophyll', 'Keratin'], correctAnswer: 'Chlorophyll', explanation: 'Chlorophyll is the green pigment that absorbs light.' },
      { question: 'What is one product of photosynthesis?', options: ['Glucose', 'Carbon dioxide', 'Nitrogen', 'Protein'], correctAnswer: 'Glucose', explanation: 'Photosynthesis produces glucose and oxygen.' },
      { question: 'Which factor can limit the rate of photosynthesis?', options: ['Ink colour', 'Light intensity', 'Soil texture only', 'Leaf shape only'], correctAnswer: 'Light intensity', explanation: 'Light intensity is one of the key limiting factors.' },
    ],
  },
  [normalizeStudyTopic('Ancient Rome')]: {
    title: 'Ancient Rome',
    questions: [
      { question: 'Who was the first emperor of Rome?', options: ['Julius Caesar', 'Augustus', 'Nero', 'Constantine'], correctAnswer: 'Augustus', explanation: 'Augustus is widely recognized as Rome’s first emperor.' },
      { question: 'What was the Pax Romana?', options: ['A military campaign', 'A religious law', 'A long period of peace', 'A trade route'], correctAnswer: 'A long period of peace', explanation: 'Pax Romana refers to an extended period of relative peace and stability.' },
      { question: 'What was the Roman Forum mainly used for?', options: ['Only farming', 'Politics and public life', 'Naval battles', 'Mining'], correctAnswer: 'Politics and public life', explanation: 'The Forum was the civic heart of Rome.' },
      { question: 'A Roman legion was a...', options: ['Temple', 'Water system', 'Army unit', 'Tax office'], correctAnswer: 'Army unit', explanation: 'A legion was a major Roman military unit.' },
      { question: 'What did aqueducts transport?', options: ['Gold', 'Water', 'Oil', 'Grain'], correctAnswer: 'Water', explanation: 'Aqueducts moved water into Roman towns and cities.' },
    ],
  },
  [normalizeStudyTopic('Algebra Help')]: {
    title: 'Algebra Help',
    questions: [
      { question: 'What is the coefficient in 5x?', options: ['x', '5', '+', '0'], correctAnswer: '5', explanation: 'The coefficient is the number multiplying the variable.' },
      { question: 'Which terms are like terms?', options: ['3x and 4x', '3x and 3y', 'x and x²', '2 and z'], correctAnswer: '3x and 4x', explanation: 'Like terms have the same variable part.' },
      { question: 'What is the first step to solve 3x = 12?', options: ['Add 3', 'Subtract 12', 'Divide by 3', 'Multiply by 12'], correctAnswer: 'Divide by 3', explanation: 'Use the inverse operation to isolate x.' },
      { question: 'Factorising is the opposite of...', options: ['Dividing', 'Expanding', 'Adding', 'Substituting'], correctAnswer: 'Expanding', explanation: 'Factorising rewrites an expanded expression into factors.' },
      { question: 'What is x if x + 7 = 10?', options: ['17', '3', '7', '10'], correctAnswer: '3', explanation: 'Subtract 7 from both sides to get x = 3.' },
    ],
  },
  [normalizeStudyTopic('Climate Change')]: {
    title: 'Climate Change',
    questions: [
      { question: 'Which gas is a major greenhouse gas?', options: ['Helium', 'Carbon dioxide', 'Neon', 'Argon'], correctAnswer: 'Carbon dioxide', explanation: 'Carbon dioxide is one of the main greenhouse gases.' },
      { question: 'What does mitigation mean in climate science?', options: ['Ignoring impacts', 'Reducing emissions', 'Planting only one tree', 'Tracking rainfall only'], correctAnswer: 'Reducing emissions', explanation: 'Mitigation focuses on reducing the causes of climate change.' },
      { question: 'Sea-level rise is linked to...', options: ['Space travel', 'Melting ice and warming oceans', 'Lunar tides only', 'Soil quality'], correctAnswer: 'Melting ice and warming oceans', explanation: 'Warming expands water and melting land ice adds volume.' },
      { question: 'Renewable energy includes...', options: ['Coal', 'Diesel', 'Solar', 'Petrol'], correctAnswer: 'Solar', explanation: 'Solar is a renewable energy source.' },
      { question: 'Adaptation means...', options: ['Denying climate change', 'Adjusting to climate impacts', 'Only measuring carbon', 'Banning weather'], correctAnswer: 'Adjusting to climate impacts', explanation: 'Adaptation helps people cope with climate effects already happening.' },
    ],
  },
  [normalizeStudyTopic('Shakespeare')]: {
    title: 'Shakespeare',
    questions: [
      { question: 'What is a soliloquy?', options: ['A group dance', 'A speech revealing inner thoughts', 'A type of costume', 'A battle scene'], correctAnswer: 'A speech revealing inner thoughts', explanation: 'A soliloquy allows the audience to hear a character’s private thinking.' },
      { question: 'Macbeth is best classified as a...', options: ['Comedy', 'Documentary', 'Tragedy', 'Musical'], correctAnswer: 'Tragedy', explanation: 'Macbeth is one of Shakespeare’s major tragedies.' },
      { question: 'Iambic pentameter refers to...', options: ['A sword style', 'A poetic rhythm', 'A building design', 'A Roman law'], correctAnswer: 'A poetic rhythm', explanation: 'It is a metrical pattern commonly used in Shakespeare’s verse.' },
      { question: 'Dramatic irony occurs when...', options: ['Nothing happens', 'The audience knows more than the character', 'A joke is told', 'A scene is repeated'], correctAnswer: 'The audience knows more than the character', explanation: 'Dramatic irony depends on the audience having extra knowledge.' },
      { question: 'A theme in Shakespeare is...', options: ['Ink colour', 'A repeated central idea', 'A stage prop', 'A costume note'], correctAnswer: 'A repeated central idea', explanation: 'Themes are the major ideas explored through the play.' },
    ],
  },
  [normalizeStudyTopic('Coding Basics')]: {
    title: 'Coding Basics',
    questions: [
      { question: 'What does a variable store?', options: ['Only images', 'A value or data', 'Only errors', 'Only comments'], correctAnswer: 'A value or data', explanation: 'Variables store data that code can use later.' },
      { question: 'What is a loop used for?', options: ['Deleting files only', 'Repeating instructions', 'Naming a project', 'Changing monitor brightness'], correctAnswer: 'Repeating instructions', explanation: 'Loops repeat a set of instructions.' },
      { question: 'What is an algorithm?', options: ['A hardware cable', 'A step-by-step process', 'A screen colour', 'A password manager'], correctAnswer: 'A step-by-step process', explanation: 'An algorithm is a procedure for solving a problem.' },
      { question: 'What is debugging?', options: ['Adding bugs', 'Fixing code problems', 'Deleting all code', 'Changing fonts'], correctAnswer: 'Fixing code problems', explanation: 'Debugging means finding and correcting errors.' },
      { question: 'What is a function?', options: ['A broken feature', 'A reusable code block', 'A network wire', 'A battery setting'], correctAnswer: 'A reusable code block', explanation: 'Functions package instructions you can reuse.' },
    ],
  },
};

const MATH_PRESET_LIBRARY: Record<string, MathSolverResponse> = {
  [normalizeStudyTopic('Solve 2x^2 - 5x - 3 = 0')]: {
    problemType: 'Quadratic equation',
    normalizedProblem: '2x^2 - 5x - 3 = 0',
    exactAnswer: 'x = 3 or x = -1/2',
    decimalAnswer: 'x = 3 or x = -0.5',
    assumptions: ['Solve over the real numbers.'],
    steps: [
      { title: 'Factor the quadratic', work: '2x^2 - 5x - 3 = (2x + 1)(x - 3)', explanation: 'The quadratic factors because the product is -6 and the middle term is -5x.', check: 'Expanding (2x + 1)(x - 3) gives 2x^2 - 5x - 3.' },
      { title: 'Use the zero-product rule', work: '(2x + 1)(x - 3) = 0', explanation: 'If a product is zero, then at least one factor must be zero.', check: 'This rule applies to all real-number products equal to zero.' },
      { title: 'Solve each factor', work: '2x + 1 = 0 => x = -1/2\nx - 3 = 0 => x = 3', explanation: 'Set each factor equal to zero and solve the linear equations.', check: 'Both solutions satisfy one of the factors.' },
    ],
    verification: 'Substituting x = 3 gives 18 - 15 - 3 = 0. Substituting x = -1/2 gives 2(1/4) + 5/2 - 3 = 0.',
    followUpQuestions: ['Can you solve this using the quadratic formula instead?', 'How would the graph show these solutions?', 'What happens if the discriminant is negative?'],
  },
  [normalizeStudyTopic('Differentiate f(x)=x^3 sin(x)')]: {
    problemType: 'Differentiation using product rule',
    normalizedProblem: 'Differentiate f(x) = x^3 sin(x)',
    exactAnswer: "f'(x) = 3x^2 sin(x) + x^3 cos(x)",
    assumptions: ['Differentiate with respect to x.'],
    steps: [
      { title: 'Identify the two factors', work: 'u = x^3, v = sin(x)', explanation: 'This is a product of two differentiable functions.', check: 'The product rule applies to u·v.' },
      { title: 'Differentiate each factor', work: "u' = 3x^2, v' = cos(x)", explanation: 'Use the power rule for x^3 and the standard derivative of sin(x).', check: 'd/dx[sin(x)] = cos(x).' },
      { title: 'Apply the product rule', work: "f'(x) = u'v + uv' = 3x^2 sin(x) + x^3 cos(x)", explanation: 'The derivative of a product is the first derivative times the second plus the first times the second derivative.', check: 'Both terms are required; omitting one is a common error.' },
    ],
    verification: 'Differentiate again mentally term-by-term to confirm the structure follows the product rule correctly.',
    followUpQuestions: ['How would this change if the function were x^3 cos(x)?', 'Can you factor the derivative?', 'Where could this derivative equal zero?'],
  },
  [normalizeStudyTopic('Integrate (3x^2 + 4x - 1) dx')]: {
    problemType: 'Indefinite integral',
    normalizedProblem: 'Integrate (3x^2 + 4x - 1) dx',
    exactAnswer: 'x^3 + 2x^2 - x + C',
    assumptions: ['Find an indefinite integral with constant of integration C.'],
    steps: [
      { title: 'Integrate term by term', work: '∫(3x^2 + 4x - 1) dx = ∫3x^2 dx + ∫4x dx - ∫1 dx', explanation: 'Linearity lets us integrate each term separately.', check: 'This is valid for polynomial expressions.' },
      { title: 'Apply the power rule', work: '∫3x^2 dx = x^3\n∫4x dx = 2x^2\n∫1 dx = x', explanation: 'Increase each power by one and divide by the new power.', check: 'For x^2, the new power is 3, so 3/3 = 1.' },
      { title: 'Combine the result', work: 'x^3 + 2x^2 - x + C', explanation: 'Add the antiderivatives and include the constant of integration.', check: 'Differentiate x^3 + 2x^2 - x to recover 3x^2 + 4x - 1.' },
    ],
    verification: 'd/dx[x^3 + 2x^2 - x + C] = 3x^2 + 4x - 1.',
    followUpQuestions: ['What would change in a definite integral?', 'Can you integrate 3x^2 + 4x - 1 from 0 to 2?', 'Why do we add +C?'],
  },
  [normalizeStudyTopic('Find the limit as x -> 0 of sin(5x)/x')]: {
    problemType: 'Limit',
    normalizedProblem: 'Find the limit as x -> 0 of sin(5x)/x',
    exactAnswer: '5',
    assumptions: ['Use the standard limit lim(t->0) sin(t)/t = 1.'],
    steps: [
      { title: 'Rewrite the expression', work: 'sin(5x)/x = 5 · sin(5x)/(5x)', explanation: 'Multiply and divide by 5 to match the standard limit form.', check: '5·sin(5x)/(5x) simplifies back to sin(5x)/x.' },
      { title: 'Apply the standard limit', work: 'As x -> 0, 5x -> 0 so sin(5x)/(5x) -> 1', explanation: 'The standard trigonometric limit applies when the angle approaches zero.', check: 'Because 5x approaches 0, the pattern is valid.' },
      { title: 'Multiply by the constant', work: '5 · 1 = 5', explanation: 'The remaining constant carries through the limit.', check: 'The limit is therefore 5.' },
    ],
    verification: 'Using the small-angle approximation sin(5x) ≈ 5x near 0 also gives 5x/x = 5.',
    followUpQuestions: ['What is lim x->0 of sin(7x)/x?', 'How would this change for tan(5x)/x?', 'Why does the standard limit matter in derivatives?'],
  },
};

export function createPresetFlashcardSet(topic: string, userId: string): Omit<FlashcardSet, 'id'> | null {
  const preset = FLASHCARD_PRESET_LIBRARY[normalizeStudyTopic(topic)];
  if (!preset) return null;
  return {
    ...preset,
    userId,
    createdAt: new Date().toISOString(),
  };
}

export function createPresetQuiz(topic: string, userId: string): Omit<Quiz, 'id'> | null {
  const preset = QUIZ_PRESET_LIBRARY[normalizeStudyTopic(topic)];
  if (!preset) return null;
  return {
    ...preset,
    userId,
    createdAt: new Date().toISOString(),
  };
}

export function getMathSolverPreset(problem: string) {
  return MATH_PRESET_LIBRARY[normalizeStudyTopic(problem)] || null;
}

export function getAppReviewSeedFlashcardSets(userId: string): Array<Omit<FlashcardSet, 'id'>> {
  return ['Photosynthesis', 'Algebra Help', 'Shakespeare']
    .map((topic) => createPresetFlashcardSet(topic, userId))
    .filter((item): item is Omit<FlashcardSet, 'id'> => Boolean(item));
}

export function getAppReviewSeedQuizzes(userId: string): Array<Omit<Quiz, 'id'>> {
  return ['Photosynthesis', 'Ancient Rome', 'Coding Basics']
    .map((topic) => createPresetQuiz(topic, userId))
    .filter((item): item is Omit<Quiz, 'id'> => Boolean(item));
}
