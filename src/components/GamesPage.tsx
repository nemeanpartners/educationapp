import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  Car,
  CheckCircle2,
  Compass,
  Flag,
  Gamepad2,
  Leaf,
  Map,
  Play,
  RotateCcw,
  Rocket,
  Sparkles,
  Timer,
  Trophy,
  Zap,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { detectStudentPortalFromPath, studentPortalPath, studentPortalToolPath } from '../lib/portal';

type MemoryTopic = 'science' | 'english' | 'maths' | 'business' | 'psychology' | 'engineering';
type MemoryDifficulty = 'quick' | 'standard' | 'challenge';

const memoryTopics: Record<MemoryTopic, {
  label: string;
  description: string;
  pairs: { id: string; term: string; match: string }[];
}> = {
  science: {
    label: 'Science',
    description: 'Match biology, forces, and energy concepts.',
    pairs: [
      { id: 'photosynthesis', term: 'Photosynthesis', match: 'Plants turn light into glucose' },
      { id: 'gravity', term: 'Gravity', match: 'Force pulling objects together' },
      { id: 'evaporation', term: 'Evaporation', match: 'Liquid changes into gas' },
      { id: 'cell', term: 'Cell', match: 'Basic unit of living things' },
      { id: 'conductor', term: 'Conductor', match: 'Material that lets energy flow' },
      { id: 'ecosystem', term: 'Ecosystem', match: 'Living and non-living parts together' },
      { id: 'atom', term: 'Atom', match: 'Small unit of matter' },
      { id: 'orbit', term: 'Orbit', match: 'Path around another object' },
    ],
  },
  english: {
    label: 'English',
    description: 'Match writing terms, devices, and essay structure.',
    pairs: [
      { id: 'thesis', term: 'Thesis', match: 'Main argument in an essay' },
      { id: 'metaphor', term: 'Metaphor', match: 'Comparison without like or as' },
      { id: 'simile', term: 'Simile', match: 'Comparison using like or as' },
      { id: 'evidence', term: 'Evidence', match: 'Proof supporting a point' },
      { id: 'topic', term: 'Topic sentence', match: 'Main idea of a paragraph' },
      { id: 'tone', term: 'Tone', match: 'Writer attitude or mood' },
      { id: 'context', term: 'Context', match: 'Background around a text' },
      { id: 'conclusion', term: 'Conclusion', match: 'Final wrap-up of ideas' },
    ],
  },
  maths: {
    label: 'Maths',
    description: 'Match formulas, numbers, and operations.',
    pairs: [
      { id: 'half', term: '1/2', match: '0.5' },
      { id: 'mean', term: 'Mean', match: 'Sum divided by count' },
      { id: 'perimeter', term: 'Perimeter', match: 'Distance around a shape' },
      { id: 'area', term: 'Area', match: 'Space inside a shape' },
      { id: 'prime', term: 'Prime number', match: 'Only divisible by 1 and itself' },
      { id: 'factor', term: 'Factor', match: 'Number that divides evenly' },
      { id: 'radius', term: 'Radius', match: 'Centre to circle edge' },
      { id: 'equation', term: 'Equation', match: 'Math statement with equals sign' },
    ],
  },
  business: {
    label: 'Business Strategy',
    description: 'Review commercial terms, metrics, and strategy language.',
    pairs: [
      { id: 'market-share', term: 'Market share', match: 'Percentage of total market sales held by one firm' },
      { id: 'margin', term: 'Gross margin', match: 'Revenue left after direct cost of goods' },
      { id: 'retention', term: 'Retention', match: 'Ability to keep customers over time' },
      { id: 'cac', term: 'Customer acquisition cost', match: 'Average spend required to win a new customer' },
      { id: 'positioning', term: 'Positioning', match: 'How a brand is differentiated in the market' },
      { id: 'runway', term: 'Runway', match: 'Time a business can operate before cash is exhausted' },
      { id: 'ltv', term: 'Lifetime value', match: 'Projected value of a customer across the relationship' },
      { id: 'kpi', term: 'KPI', match: 'Key performance indicator used to track progress' },
    ],
  },
  psychology: {
    label: 'Psychology',
    description: 'Test recall on methods, cognition, and behavioural science concepts.',
    pairs: [
      { id: 'operant', term: 'Operant conditioning', match: 'Learning shaped by consequences and reinforcement' },
      { id: 'working-memory', term: 'Working memory', match: 'Short-term mental space used to hold and manipulate information' },
      { id: 'validity', term: 'Construct validity', match: 'Whether a measure captures the intended concept' },
      { id: 'confound', term: 'Confounding variable', match: 'External factor that distorts the result' },
      { id: 'schema', term: 'Schema', match: 'Mental framework used to organise knowledge' },
      { id: 'sample-bias', term: 'Sampling bias', match: 'Selection issue that makes a sample unrepresentative' },
      { id: 'neuroplasticity', term: 'Neuroplasticity', match: 'Brain ability to reorganise through experience' },
      { id: 'correlation', term: 'Correlation', match: 'Relationship between variables without proving causation' },
    ],
  },
  engineering: {
    label: 'Engineering Systems',
    description: 'Run concept decks on systems, optimisation, and design logic.',
    pairs: [
      { id: 'load-factor', term: 'Load factor', match: 'Measure of stress or demand placed on a system' },
      { id: 'redundancy', term: 'Redundancy', match: 'Backup capacity built in to improve reliability' },
      { id: 'tolerance', term: 'Tolerance', match: 'Allowed variation from a specified dimension or value' },
      { id: 'feedback-loop', term: 'Feedback loop', match: 'System output fed back to influence future performance' },
      { id: 'optimisation', term: 'Optimisation', match: 'Process of improving performance under constraints' },
      { id: 'failure-mode', term: 'Failure mode', match: 'Specific way a component or process can fail' },
      { id: 'throughput', term: 'Throughput', match: 'Amount of work or material processed in a given time' },
      { id: 'prototype', term: 'Prototype', match: 'Early test model used to validate a design' },
    ],
  },
};

const highSchoolMemoryTopicIds: MemoryTopic[] = ['science', 'english', 'maths'];
const universityMemoryTopicIds: MemoryTopic[] = ['business', 'psychology', 'engineering'];

const difficultyPairs: Record<MemoryDifficulty, number> = {
  quick: 4,
  standard: 6,
  challenge: 8,
};

const highSchoolTreeTopics = [
  {
    id: 'assignment',
    label: 'Assignment Structure',
    description: 'Grow a tree by answering questions about planning and paragraph structure.',
    nodes: [
      {
        id: 'roots',
        title: 'Roots',
        prompt: 'What is the first step when starting an assignment?',
        options: ['Understand the task', 'Write the final paragraph', 'Pick a font'],
        answer: 'Understand the task',
        reward: 'Strong roots: you know how to begin with the task requirements.',
      },
      {
        id: 'trunk',
        title: 'Trunk',
        prompt: 'Which sentence usually states the main argument of an essay?',
        options: ['Topic sentence', 'Thesis statement', 'Bibliography'],
        answer: 'Thesis statement',
        reward: 'Stable trunk: your main idea is clear.',
      },
      {
        id: 'branches',
        title: 'Branches',
        prompt: 'What should each body paragraph usually focus on?',
        options: ['One clear idea', 'Every possible detail', 'Only the conclusion'],
        answer: 'One clear idea',
        reward: 'Useful branches: each idea has its own place.',
      },
      {
        id: 'leaves',
        title: 'Leaves',
        prompt: 'What helps prove a point in a paragraph?',
        options: ['Evidence', 'Random colour', 'Longer margins'],
        answer: 'Evidence',
        reward: 'Healthy leaves: evidence supports your thinking.',
      },
    ],
  },
  {
    id: 'revision',
    label: 'Revision Habits',
    description: 'Build better revision habits through quick choices.',
    nodes: [
      {
        id: 'plan',
        title: 'Plan',
        prompt: 'What makes revision easier to start?',
        options: ['A small clear goal', 'Waiting until midnight', 'Studying everything at once'],
        answer: 'A small clear goal',
        reward: 'Your revision plan has a clear starting point.',
      },
      {
        id: 'recall',
        title: 'Recall',
        prompt: 'Which method checks what you remember without looking?',
        options: ['Active recall', 'Highlighting only', 'Changing pen colour'],
        answer: 'Active recall',
        reward: 'Your tree grows stronger with active recall.',
      },
      {
        id: 'space',
        title: 'Space',
        prompt: 'What is spaced practice?',
        options: ['Reviewing across several days', 'One long cram', 'Skipping hard topics'],
        answer: 'Reviewing across several days',
        reward: 'Spacing helps memory last longer.',
      },
      {
        id: 'reflect',
        title: 'Reflect',
        prompt: 'What should you do after a practice quiz?',
        options: ['Review mistakes', 'Ignore wrong answers', 'Delete the quiz'],
        answer: 'Review mistakes',
        reward: 'Reflection turns mistakes into next steps.',
      },
    ],
  },
];

const universityTreeTopics = [
  {
    id: 'case-analysis',
    label: 'Case Analysis',
    description: 'Work through the logic behind a stronger university-level response.',
    nodes: [
      {
        id: 'brief',
        title: 'Brief',
        prompt: 'What should you confirm before building any recommendation in a case response?',
        options: ['The objective and evaluation criteria', 'The color palette of the slides', 'The final conclusion line'],
        answer: 'The objective and evaluation criteria',
        reward: 'Strong opening: your analysis starts from the actual objective, not guesswork.',
      },
      {
        id: 'frame',
        title: 'Frame',
        prompt: 'What makes an analysis framework useful?',
        options: ['It groups the problem into clear buckets', 'It hides weak reasoning with more words', 'It removes the need for evidence'],
        answer: 'It groups the problem into clear buckets',
        reward: 'Good structure: the problem is now organised into usable lines of reasoning.',
      },
      {
        id: 'evidence',
        title: 'Evidence',
        prompt: 'What should each recommendation be anchored in?',
        options: ['Evidence, tradeoffs, and assumptions', 'Personal preference only', 'The longest paragraph available'],
        answer: 'Evidence, tradeoffs, and assumptions',
        reward: 'Analytical credibility improved: the recommendation has support behind it.',
      },
      {
        id: 'decision',
        title: 'Decision',
        prompt: 'What makes a final recommendation feel executive-ready?',
        options: ['It is clear, prioritized, and actionable', 'It mentions every idea equally', 'It avoids making a decision'],
        answer: 'It is clear, prioritized, and actionable',
        reward: 'Decision layer unlocked: the answer now reads like a real recommendation.',
      },
    ],
  },
  {
    id: 'research-methods',
    label: 'Research Methods',
    description: 'Sharpen the judgment calls behind stronger academic research design.',
    nodes: [
      {
        id: 'question',
        title: 'Research Question',
        prompt: 'What makes a research question stronger?',
        options: ['It is specific, answerable, and scoped', 'It tries to cover everything at once', 'It avoids defining any variables'],
        answer: 'It is specific, answerable, and scoped',
        reward: 'Question quality improved: the project has a defensible scope.',
      },
      {
        id: 'method',
        title: 'Method Choice',
        prompt: 'When should you prefer qualitative methods?',
        options: ['When depth of perspective matters', 'When you want random numbers only', 'When no interpretation is required'],
        answer: 'When depth of perspective matters',
        reward: 'Method logic strengthened: your design fits the kind of insight you want.',
      },
      {
        id: 'ethics',
        title: 'Ethics',
        prompt: 'Why does ethics review matter in human research?',
        options: ['It protects participants and research integrity', 'It speeds up every project automatically', 'It removes the need for consent'],
        answer: 'It protects participants and research integrity',
        reward: 'Research integrity unlocked: the design now accounts for participant protection.',
      },
      {
        id: 'analysis',
        title: 'Analysis Plan',
        prompt: 'What should happen before data collection begins?',
        options: ['Define how the data will be analyzed', 'Wait and improvise later', 'Choose citations before the method'],
        answer: 'Define how the data will be analyzed',
        reward: 'Analysis clarity improved: you now know what the data must support.',
      },
    ],
  },
];

const spaceStops = [
  {
    id: 'mercury',
    name: 'Mercury',
    clue: 'This planet is closest to the Sun, but it is not the hottest planet.',
    prompt: 'Why can Mercury become extremely cold at night?',
    options: ['It has almost no atmosphere', 'It is made of ice', 'It spins backward'],
    answer: 'It has almost no atmosphere',
    fact: 'Mercury has almost no atmosphere to trap heat, so temperatures swing sharply between day and night.',
  },
  {
    id: 'venus',
    name: 'Venus',
    clue: 'A bright world wrapped in thick clouds.',
    prompt: 'What makes Venus the hottest planet in the Solar System?',
    options: ['A strong greenhouse effect', 'It is closest to the Sun', 'It has no clouds'],
    answer: 'A strong greenhouse effect',
    fact: 'Venus has a thick carbon dioxide atmosphere that traps heat through an intense greenhouse effect.',
  },
  {
    id: 'mars',
    name: 'Mars',
    clue: 'The red planet has valleys, volcanoes, and signs that water once flowed there.',
    prompt: 'What gives Mars its rusty red color?',
    options: ['Iron oxide in its dust', 'Red ocean water', 'Glowing lava everywhere'],
    answer: 'Iron oxide in its dust',
    fact: 'Iron oxide, the same kind of compound found in rust, colors much of the Martian surface.',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    clue: 'A giant planet with a storm wider than Earth.',
    prompt: 'What is the Great Red Spot?',
    options: ['A long-lasting storm', 'A giant crater', 'A frozen moon'],
    answer: 'A long-lasting storm',
    fact: 'The Great Red Spot is a huge storm system that has been observed for hundreds of years.',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    clue: 'The ringed planet is famous for ice and rock orbiting around it.',
    prompt: 'What are Saturns rings mostly made of?',
    options: ['Ice, dust, and rock', 'Liquid gold', 'Burning gas'],
    answer: 'Ice, dust, and rock',
    fact: 'Saturns rings are mostly countless pieces of ice and rock, from tiny grains to large chunks.',
  },
];

const highSchoolAtlasStops = [
  {
    id: 'rainforest',
    title: 'Rainforest Canopy',
    clue: 'The map points to a layered forest full of biodiversity.',
    prompt: 'Why are rainforests important for ecosystems?',
    options: ['They support many species', 'They stop all weather', 'They have no plants'],
    answer: 'They support many species',
    reward: 'Canopy badge found: rainforests contain many habitats stacked from forest floor to canopy.',
  },
  {
    id: 'reef',
    title: 'Coral Reef',
    clue: 'Your compass finds a bright underwater city.',
    prompt: 'What are coral reefs especially good at providing?',
    options: ['Habitat for marine life', 'Fresh drinking water', 'Volcanic ash'],
    answer: 'Habitat for marine life',
    reward: 'Reef badge found: coral reefs shelter fish, invertebrates, and many young marine animals.',
  },
  {
    id: 'desert',
    title: 'Desert Dunes',
    clue: 'The path crosses a dry region where survival takes special adaptations.',
    prompt: 'What helps many desert animals conserve water?',
    options: ['Being active at cooler times', 'Growing large leaves', 'Living only in snow'],
    answer: 'Being active at cooler times',
    reward: 'Dune badge found: many desert animals avoid heat by being active at night or near dawn.',
  },
  {
    id: 'volcano',
    title: 'Volcano Ridge',
    clue: 'The final marker sits beside a mountain built from eruptions.',
    prompt: 'What can volcanic eruptions create over time?',
    options: ['New landforms and fertile soils', 'Only empty space', 'Permanent silence'],
    answer: 'New landforms and fertile soils',
    reward: 'Ridge badge found: volcanoes can build islands, mountains, and mineral-rich soils.',
  },
];

const universityAtlasStops = [
  {
    id: 'macro',
    title: 'Macroeconomic Signals',
    clue: 'Your atlas opens on inflation, rates, employment, and consumer confidence.',
    prompt: 'Why do central banks usually raise interest rates during high inflation?',
    options: ['To reduce spending pressure in the economy', 'To increase inflation faster', 'To guarantee higher wages immediately'],
    answer: 'To reduce spending pressure in the economy',
    reward: 'Signal logged: rate increases are used to cool demand and ease inflation pressure.',
  },
  {
    id: 'behavioral',
    title: 'Behavioral Psychology',
    clue: 'This domain tracks attention, habit loops, and decision bias.',
    prompt: 'What is a common effect of confirmation bias?',
    options: ['People favor evidence that supports existing beliefs', 'People remember everything equally', 'People stop making decisions entirely'],
    answer: 'People favor evidence that supports existing beliefs',
    reward: 'Insight logged: confirmation bias distorts judgment by filtering what evidence feels persuasive.',
  },
  {
    id: 'systems',
    title: 'Systems Engineering',
    clue: 'The map highlights reliability, constraints, and interdependent components.',
    prompt: 'Why is systems thinking valuable in engineering design?',
    options: ['It helps assess how changes affect the whole system', 'It removes the need for testing', 'It focuses only on one isolated part'],
    answer: 'It helps assess how changes affect the whole system',
    reward: 'System insight logged: strong design decisions consider interactions, tradeoffs, and downstream effects.',
  },
  {
    id: 'strategy',
    title: 'Media and Brand Strategy',
    clue: 'This region covers positioning, audience behavior, and channel choices.',
    prompt: 'What does clear brand positioning help a team do?',
    options: ['Differentiate the offer in the market', 'Eliminate the need for a target audience', 'Avoid making strategic choices'],
    answer: 'Differentiate the offer in the market',
    reward: 'Strategy insight logged: positioning gives the brand a sharper and more memorable place in the market.',
  },
];

const TRIVIA_RUN_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trivia Temple Run</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1a0a2e;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
  }
  #gameCanvas { display: block; width: 100%; height: 100%; }
  #ui { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
  #scoreBar {
    position: absolute; top: 14px; left: 0; width: 100%;
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 20px;
  }
  #scoreEl { color: #FFD700; font-size: 22px; font-weight: 700; text-shadow: 0 0 12px #FFD70099; }
  #livesEl { display: flex; gap: 7px; align-items: center; }
  .life-icon {
    width: 24px; height: 24px;
    background: #FF4444; border-radius: 50%;
    border: 2px solid #FF8888;
    box-shadow: 0 0 10px #FF444499;
    transition: all 0.3s;
  }
  .life-icon.lost { background: #2a2a2a; border-color: #444; box-shadow: none; }
  #countEl { color: #00FFAA; font-size: 22px; font-weight: 700; text-shadow: 0 0 12px #00FFAA99; }
  #streakEl {
    position: absolute; top: 54px; left: 50%; transform: translateX(-50%);
    color: #FF8C00; font-size: 14px; font-weight: 700;
    text-shadow: 0 0 8px #FF8C0099;
    white-space: nowrap;
  }
  #triviaPanel {
    position: absolute; bottom: 0; left: 0; width: 100%;
    pointer-events: all;
    transform: translateY(100%);
    transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  #triviaPanel.show { transform: translateY(0); }
  #triviaInner {
    background: linear-gradient(160deg, #0d0020 0%, #1c0050 100%);
    border-top: 2.5px solid #7B2FBE;
    padding: 18px 20px 22px;
    box-shadow: 0 -10px 40px #7B2FBE55;
  }
  #questionText {
    color: #E0D0FF; font-size: 16px; font-weight: 600;
    text-align: center; margin-bottom: 14px; line-height: 1.5;
  }
  #answersGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .answer-btn {
    background: #2a0060; border: 1.5px solid #7B2FBE;
    color: #D0BBFF; padding: 13px 10px;
    border-radius: 14px; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: all 0.18s; text-align: center;
    font-family: inherit;
  }
  .answer-btn:hover:not(:disabled) { background: #3d0090; border-color: #AA55FF; color: #fff; transform: scale(1.03); }
  .answer-btn.correct { background: #003d2a !important; border-color: #00FF88 !important; color: #00FF88 !important; }
  .answer-btn.wrong { background: #3d0010 !important; border-color: #FF4444 !important; color: #FF4444 !important; }
  .answer-btn:disabled { cursor: default; }
  #powerupNotif {
    position: absolute; top: 45%; left: 50%;
    transform: translate(-50%,-50%) scale(0);
    color: #000; padding: 13px 32px;
    border-radius: 50px; font-size: 20px; font-weight: 800;
    pointer-events: none;
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
    white-space: nowrap; letter-spacing: 0.5px;
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  #powerupNotif.show { transform: translate(-50%,-50%) scale(1); }
  #startScreen, #gameoverScreen {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at center, #2a0060 0%, #0d0020 70%);
    pointer-events: all;
    z-index: 10;
  }
  .screen-icon { font-size: 64px; margin-bottom: 12px; filter: drop-shadow(0 0 20px rgba(123,47,190,0.8)); }
  #startScreen h1 {
    color: #FFD700; font-size: 34px; font-weight: 900;
    text-shadow: 0 0 24px #FFD70099, 0 2px 0 #A0700055;
    margin-bottom: 10px; text-align: center; letter-spacing: 1px;
  }
  #startScreen p {
    color: #C0A0FF; font-size: 15px; text-align: center;
    margin-bottom: 32px; max-width: 320px; line-height: 1.7;
  }
  #startScreen p span { color: #FFD700; font-weight: 700; }
  #gameoverScreen h1 {
    color: #FF4444; font-size: 40px; font-weight: 900;
    text-shadow: 0 0 24px #FF444499;
    margin-bottom: 8px;
  }
  .final-score-label { color: #9977CC; font-size: 14px; margin-bottom: 4px; }
  .final-score { color: #FFD700; font-size: 26px; font-weight: 700; margin-bottom: 30px; text-align: center; }
  .big-btn {
    background: linear-gradient(135deg, #7B2FBE, #4B0082);
    color: #fff; border: 2px solid #AA55FF;
    padding: 15px 44px; border-radius: 50px;
    font-size: 18px; font-weight: 700; cursor: pointer;
    transition: all 0.2s; font-family: inherit; letter-spacing: 0.5px;
  }
  .big-btn:hover { transform: scale(1.06); box-shadow: 0 0 30px #7B2FBE99; }
  #gameoverScreen { display: none; }
  .how-to {
    display: flex; gap: 18px; margin-bottom: 28px;
    flex-wrap: wrap; justify-content: center; max-width: 340px;
  }
  .how-item {
    display: flex; flex-direction: column; align-items: center;
    gap: 4px; font-size: 12px; color: #9977CC; text-align: center; max-width: 70px;
  }
  .how-item .hi { font-size: 24px; }
</style>
</head>
<body>
<canvas id="gameCanvas"></canvas>
<div id="ui">
  <div id="scoreBar">
    <div id="scoreEl">0m</div>
    <div id="livesEl"></div>
    <div id="countEl">×1</div>
  </div>
  <div id="streakEl"></div>
  <div id="triviaPanel">
    <div id="triviaInner">
      <div id="questionText"></div>
      <div id="answersGrid"></div>
    </div>
  </div>
  <div id="powerupNotif"></div>
</div>
<div id="startScreen">
  <div class="screen-icon">🏛️</div>
  <h1>TRIVIA TEMPLE</h1>
  <div class="how-to">
    <div class="how-item"><span class="hi">❓</span>Answer trivia</div>
    <div class="how-item"><span class="hi">⚡</span>Get power-ups</div>
    <div class="how-item"><span class="hi">👥</span>Grow your squad</div>
    <div class="how-item"><span class="hi">❤️</span>Don't die!</div>
  </div>
  <p>Right answers <span>multiply your runners</span>.<br>Wrong answers cost lives & shrink your squad.</p>
  <button class="big-btn" id="startBtn">START RUNNING</button>
</div>
<div id="gameoverScreen">
  <div class="screen-icon">💀</div>
  <h1>GAME OVER</h1>
  <div class="final-score-label">YOUR RUN</div>
  <div class="final-score" id="finalScore"></div>
  <button class="big-btn" id="restartBtn">TRY AGAIN</button>
</div>
<script>
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const triviaPanel = document.getElementById('triviaPanel');
const questionText = document.getElementById('questionText');
const answersGrid = document.getElementById('answersGrid');
const powerupNotif = document.getElementById('powerupNotif');
const scoreEl = document.getElementById('scoreEl');
const livesEl = document.getElementById('livesEl');
const countEl = document.getElementById('countEl');
const streakEl = document.getElementById('streakEl');
let W, H;
function resize() {
  W = canvas.offsetWidth;
  H = canvas.offsetHeight;
  canvas.width = W;
  canvas.height = H;
}
resize();
window.addEventListener('resize', () => { resize(); });
const questions = [
  { q: "What is the capital of France?", a: ["Paris","London","Berlin","Madrid"], c: 0 },
  { q: "How many sides does a hexagon have?", a: ["5","6","7","8"], c: 1 },
  { q: "What planet is closest to the Sun?", a: ["Venus","Earth","Mercury","Mars"], c: 2 },
  { q: "Who wrote Romeo and Juliet?", a: ["Dickens","Chaucer","Shakespeare","Twain"], c: 2 },
  { q: "What is 8 × 7?", a: ["54","56","58","62"], c: 1 },
  { q: "Which ocean is the largest?", a: ["Atlantic","Indian","Arctic","Pacific"], c: 3 },
  { q: "What is the chemical symbol for Gold?", a: ["Gd","Go","Au","Ag"], c: 2 },
  { q: "How many bones in the adult human body?", a: ["206","186","226","256"], c: 0 },
  { q: "What is the fastest land animal?", a: ["Lion","Cheetah","Greyhound","Leopard"], c: 1 },
  { q: "In which year did WW2 end?", a: ["1943","1944","1945","1946"], c: 2 },
  { q: "What is the square root of 144?", a: ["11","12","13","14"], c: 1 },
  { q: "Which planet has rings?", a: ["Jupiter","Uranus","Saturn","All of these"], c: 3 },
  { q: "What language do Brazilians speak?", a: ["Spanish","French","Portuguese","Italian"], c: 2 },
  { q: "How many continents are there?", a: ["5","6","7","8"], c: 2 },
  { q: "What is H2O commonly known as?", a: ["Oxygen","Hydrogen","Saltwater","Water"], c: 3 },
  { q: "Which is the longest river in the world?", a: ["Amazon","Congo","Nile","Mississippi"], c: 2 },
  { q: "How many players in a soccer team?", a: ["9","10","11","12"], c: 2 },
  { q: "What is the hardest natural substance?", a: ["Ruby","Diamond","Quartz","Steel"], c: 1 },
  { q: "What colour do you get mixing blue + yellow?", a: ["Purple","Orange","Green","Brown"], c: 2 },
  { q: "How many letters in the English alphabet?", a: ["24","25","26","27"], c: 2 },
];
const POWERUPS = [
  { name: "🔥 DOUBLE SQUAD!", mult: 2, add: 0, color: "#FF6B00" },
  { name: "⚡ TRIPLE SQUAD!", mult: 3, add: 0, color: "#FFD700" },
  { name: "💎 +5 RUNNERS!", mult: 1, add: 5, color: "#00FFFF" },
  { name: "🌟 +3 RUNNERS!", mult: 1, add: 3, color: "#FF55FF" },
  { name: "👑 +10 RUNNERS!", mult: 1, add: 10, color: "#FF8C00" },
];
class Game {
  constructor() {
    this.running = false;
    this.paused = false;
    this.score = 0;
    this.lives = 3;
    this.runnerCount = 1;
    this.speed = 4;
    this.streak = 0;
    this.distance = 0;
    this.questionTimer = 0;
    this.nextQuestionIn = 200;
    this.triviaOpen = false;
    this.usedQs = new Set();
    this.particles = [];
    this.obstacles = [];
    this.coins = [];
    this.runners = [];
    this.stars = [];
    this.columns = [];
    this.time = 0;
    this.flashColor = null;
    this.flashAlpha = 0;
    this.initStars();
    this.initColumns();
    this.setRunnerCount(1);
    this.updateLivesUI();
    this.updateCountUI();
    this.updateStreakUI();
    this.running = true;
  }
  initStars() {
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({ x: Math.random() * W, y: Math.random() * H * 0.7, s: Math.random() * 2 + 0.3, t: Math.random() * Math.PI * 2, speed: Math.random() * 0.5 + 0.1 });
    }
  }
  initColumns() {
    this.columns = [];
    const positions = [0.08, 0.22, 0.78, 0.92];
    positions.forEach(p => { this.columns.push({ xRatio: p, scrollY: Math.random() * 200 }); });
  }
  setRunnerCount(n) {
    this.runnerCount = Math.min(Math.max(1, Math.round(n)), 60);
    this.runners = [];
    const cx = W / 2;
    const totalSpread = Math.min(this.runnerCount * 20, W * 0.65);
    for (let i = 0; i < this.runnerCount; i++) {
      const frac = this.runnerCount > 1 ? i / (this.runnerCount - 1) : 0.5;
      const x = cx - totalSpread / 2 + frac * totalSpread;
      this.runners.push({ x, y: H * 0.58, bobOffset: i * 0.45, color: 'hsl(' + (250 + i * 7) + ',75%,65%)' });
    }
    this.updateCountUI();
  }
  updateLivesUI() {
    livesEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.className = 'life-icon' + (i >= this.lives ? ' lost' : '');
      livesEl.appendChild(d);
    }
  }
  updateCountUI() { countEl.textContent = '×' + this.runnerCount; }
  updateStreakUI() { streakEl.textContent = this.streak >= 2 ? '🔥 ' + this.streak + ' STREAK!' : ''; }
  getQuestion() {
    let avail = questions.map((q, i) => i).filter(i => !this.usedQs.has(i));
    if (avail.length === 0) { this.usedQs.clear(); avail = questions.map((_, i) => i); }
    const idx = avail[Math.floor(Math.random() * avail.length)];
    this.usedQs.add(idx);
    return questions[idx];
  }
  showTrivia() {
    if (this.triviaOpen) return;
    this.triviaOpen = true;
    this.paused = true;
    const q = this.getQuestion();
    this.currentQ = q;
    questionText.textContent = q.q;
    answersGrid.innerHTML = '';
    q.a.forEach((ans, i) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = ans;
      btn.onclick = () => this.answer(i, q.c);
      answersGrid.appendChild(btn);
    });
    triviaPanel.classList.add('show');
  }
  answer(chosen, correct) {
    const btns = answersGrid.querySelectorAll('.answer-btn');
    btns.forEach(b => b.disabled = true);
    btns[correct].classList.add('correct');
    if (chosen === correct) {
      this.streak++;
      this.updateStreakUI();
      const pu = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
      setTimeout(() => { this.applyPowerup(pu); this.closeTrivia(); }, 750);
    } else {
      btns[chosen].classList.add('wrong');
      this.streak = 0;
      this.updateStreakUI();
      this.loseLife();
      setTimeout(() => this.closeTrivia(), 900);
    }
  }
  applyPowerup(pu) {
    const newCount = Math.round(this.runnerCount * pu.mult) + pu.add;
    this.setRunnerCount(newCount);
    this.showNotif(pu.name, pu.color);
    this.flashColor = pu.color;
    this.flashAlpha = 0.4;
    for (let i = 0; i < 30; i++) this.addParticle(W / 2, H * 0.58, pu.color);
    this.score += 100;
    scoreEl.textContent = Math.round(this.distance) + 'm';
  }
  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    const newCount = Math.max(1, Math.floor(this.runnerCount / 2));
    this.setRunnerCount(newCount);
    this.updateLivesUI();
    this.flashColor = '#FF4444';
    this.flashAlpha = 0.5;
    for (let i = 0; i < 20; i++) this.addParticle(W / 2, H * 0.58, '#FF4444');
    if (this.lives <= 0) setTimeout(() => this.gameOver(), 600);
  }
  closeTrivia() {
    triviaPanel.classList.remove('show');
    setTimeout(() => {
      this.triviaOpen = false;
      this.paused = false;
      this.nextQuestionIn = 160 + Math.random() * 120;
      this.questionTimer = 0;
    }, 450);
  }
  showNotif(text, color) {
    powerupNotif.textContent = text;
    powerupNotif.style.background = 'linear-gradient(135deg, ' + color + ', ' + color + 'bb)';
    powerupNotif.classList.add('show');
    setTimeout(() => powerupNotif.classList.remove('show'), 1600);
  }
  addParticle(x, y, color) {
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * 7 + 2;
    this.particles.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2, life: 1, color, size: Math.random() * 7 + 2 });
  }
  addObstacle() {
    const types = ['wall', 'spikes', 'barrier'];
    const t = types[Math.floor(Math.random() * types.length)];
    this.obstacles.push({ x: W + 60, type: t });
  }
  addCoin() { this.coins.push({ x: W + 20, y: H * 0.55 - Math.random() * 70, r: 11, pulse: Math.random() * Math.PI * 2 }); }
  update() {
    if (!this.running || this.paused) return;
    this.time++;
    this.distance += this.speed * 0.05;
    this.speed = Math.min(4 + this.distance * 0.012, 14);
    scoreEl.textContent = Math.round(this.distance) + 'm';
    this.questionTimer++;
    if (this.questionTimer >= this.nextQuestionIn) this.showTrivia();
    if (this.time % 95 === 0) this.addObstacle();
    if (this.time % 55 === 0) this.addCoin();
    this.obstacles.forEach(o => { o.x -= this.speed; });
    this.obstacles = this.obstacles.filter(o => o.x > -120);
    this.coins.forEach(c => { c.x -= this.speed; c.pulse += 0.08; });
    this.coins = this.coins.filter(c => c.x > -60);
    this.runners.forEach(r => { r.y = H * 0.58 + Math.sin(this.time * 0.14 + r.bobOffset) * 7; });
    this.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.022; });
    this.particles = this.particles.filter(p => p.life > 0);
    this.stars.forEach(s => { s.t += 0.015; s.x -= s.speed * 0.4; if (s.x < -5) { s.x = W + 5; s.y = Math.random() * H * 0.65; } });
    if (this.flashAlpha > 0) this.flashAlpha -= 0.03;
  }
  draw() {
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#050010'); sky.addColorStop(0.5, '#0d0028'); sky.addColorStop(1, '#200050');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    this.stars.forEach(s => {
      const a = (Math.sin(s.t) + 1) * 0.35 + 0.15;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    ctx.save(); ctx.globalAlpha = 0.12;
    this.columns.forEach(col => {
      const cx = col.xRatio * W;
      ctx.fillStyle = '#9B5FDF'; ctx.fillRect(cx - 14, H * 0.08, 28, H * 0.58); ctx.fillRect(cx - 22, H * 0.07, 44, 14); ctx.fillRect(cx - 18, H * 0.64, 36, 10);
      ctx.strokeStyle = '#7B3FBF'; ctx.lineWidth = 1;
      for (let f = 0; f < 5; f++) { ctx.beginPath(); ctx.moveTo(cx - 10 + f * 5, H * 0.08); ctx.lineTo(cx - 10 + f * 5, H * 0.65); ctx.stroke(); }
    });
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = '#6B2FAE'; ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.1); ctx.lineTo(W * 0.2, H * 0.5); ctx.lineTo(W * 0.8, H * 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
    const groundY = H * 0.65;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, '#3a006a'); groundGrad.addColorStop(1, '#150030');
    ctx.fillStyle = groundGrad; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.save(); ctx.shadowColor = '#9B5FDF'; ctx.shadowBlur = 15; ctx.fillStyle = '#7B2FBE'; ctx.fillRect(0, groundY, W, 3); ctx.restore();
    const pathW = W * 0.65; const pathX = W / 2 - pathW / 2;
    const pathGrad = ctx.createLinearGradient(0, groundY, 0, H);
    pathGrad.addColorStop(0, '#4a008a44'); pathGrad.addColorStop(1, '#2a005533');
    ctx.fillStyle = pathGrad; ctx.fillRect(pathX, groundY, pathW, H - groundY);
    ctx.save(); ctx.strokeStyle = '#7B2FBE28'; ctx.lineWidth = 1;
    const gridStep = 60; const offset = (this.time * this.speed * 0.6) % gridStep;
    for (let gx = -gridStep + (pathX - offset % gridStep); gx < pathX + pathW + gridStep; gx += gridStep) { ctx.beginPath(); ctx.moveTo(gx, groundY); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = groundY; gy < H; gy += 40) { const perspective = (gy - groundY) / (H - groundY); ctx.globalAlpha = perspective * 0.3; ctx.beginPath(); ctx.moveTo(pathX, gy); ctx.lineTo(pathX + pathW, gy); ctx.stroke(); }
    ctx.restore();
    this.coins.forEach(c => {
      const pulse = Math.sin(c.pulse) * 2;
      ctx.save(); ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
      const cg = ctx.createRadialGradient(c.x - 3, c.y - 3, 1, c.x, c.y, c.r + pulse);
      cg.addColorStop(0, '#FFF0AA'); cg.addColorStop(0.5, '#FFD700'); cg.addColorStop(1, '#FF8C00');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + pulse, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(c.x - 3, c.y - 3, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    this.obstacles.forEach(o => {
      ctx.save();
      if (o.type === 'wall') {
        const wg = ctx.createLinearGradient(o.x, 0, o.x + 45, 0);
        wg.addColorStop(0, '#8B0000'); wg.addColorStop(0.5, '#FF3333'); wg.addColorStop(1, '#8B0000');
        ctx.fillStyle = wg; ctx.fillRect(o.x, groundY - 55, 45, 55); ctx.strokeStyle = '#FF6666'; ctx.lineWidth = 2; ctx.strokeRect(o.x, groundY - 55, 45, 55);
        ctx.fillStyle = '#FF000033'; for (let s = 0; s < 5; s++) { ctx.fillRect(o.x + s * 9, groundY - 55, 4, 55); } ctx.font = '22px serif'; ctx.fillText('💀', o.x + 8, groundY - 20);
      } else if (o.type === 'spikes') {
        ctx.fillStyle = '#888888'; ctx.strokeStyle = '#AAAAAA'; ctx.lineWidth = 1;
        for (let s = 0; s < 5; s++) { ctx.beginPath(); ctx.moveTo(o.x + s * 12, groundY); ctx.lineTo(o.x + s * 12 + 6, groundY - 40); ctx.lineTo(o.x + s * 12 + 12, groundY); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#FF8C00'; ctx.fillRect(o.x, groundY - 30, 12, 30); ctx.fillRect(o.x + 35, groundY - 30, 12, 30); ctx.fillStyle = '#FFD700'; ctx.fillRect(o.x, groundY - 35, 47, 10); ctx.fillStyle = '#FF8C0044'; ctx.fillRect(o.x + 12, groundY - 35, 23, 35);
      }
      ctx.restore();
    });
    const visibleRunners = this.runnerCount <= 20 ? this.runners : this.runners.filter((_, i) => i < 20);
    visibleRunners.forEach((r, i) => { this.drawRunner(r.x, r.y, r.color, i); });
    if (this.runnerCount > 20) { ctx.save(); ctx.fillStyle = '#FFD700'; ctx.font = 'bold 16px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('+' + (this.runnerCount - 20) + ' more', W / 2, H * 0.72); ctx.restore(); }
    this.particles.forEach(p => { ctx.save(); ctx.globalAlpha = p.life * 0.9; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    if (this.flashAlpha > 0) { ctx.save(); ctx.globalAlpha = this.flashAlpha; ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
  drawRunner(x, y, color, idx) {
    const t = this.time; const legSwing = Math.sin(t * 0.2 + idx * 0.6) * 12; const armSwing = Math.sin(t * 0.2 + idx * 0.6 + Math.PI) * 10;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, H * 0.65, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x - 7 + legSwing, y + 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 7 - legSwing, y + 24); ctx.stroke();
    const bodyGrad = ctx.createLinearGradient(x - 9, y - 14, x + 9, y + 8); bodyGrad.addColorStop(0, '#ffffff'); bodyGrad.addColorStop(1, color);
    ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.roundRect(x - 9, y - 14, 18, 24, 4); ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(x - 9, y - 6); ctx.lineTo(x - 20 + armSwing, y + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 9, y - 6); ctx.lineTo(x + 20 - armSwing, y + 5); ctx.stroke();
    ctx.fillStyle = '#FFCC88'; ctx.beginPath(); ctx.arc(x, y - 20, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 3.5, y - 22, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 3.5, y - 22, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#662200'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - 18, 4, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.restore();
  }
  gameOver() {
    this.running = false; triviaPanel.classList.remove('show');
    document.getElementById('finalScore').innerHTML = Math.round(this.distance) + 'm &nbsp;|&nbsp; ×' + this.runnerCount + ' runners';
    document.getElementById('gameoverScreen').style.display = 'flex';
  }
}
let game = null; let animId = null;
function loop() { if (game) { game.update(); game.draw(); } animId = requestAnimationFrame(loop); }
document.getElementById('startBtn').onclick = () => { document.getElementById('startScreen').style.display = 'none'; if (animId) cancelAnimationFrame(animId); game = new Game(); loop(); };
document.getElementById('restartBtn').onclick = () => { document.getElementById('gameoverScreen').style.display = 'none'; if (animId) cancelAnimationFrame(animId); game = new Game(); loop(); };
document.addEventListener('keydown', e => {
  if (!game || !game.triviaOpen) return;
  const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
  if (map[e.key] !== undefined) {
    const btns = answersGrid.querySelectorAll('.answer-btn:not(:disabled)');
    if (btns[map[e.key]]) btns[map[e.key]].click();
  }
});
</script>
</body>
</html>`;

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildMemoryDeck(topic: MemoryTopic, difficulty: MemoryDifficulty) {
  const pairs = shuffle(memoryTopics[topic].pairs).slice(0, difficultyPairs[difficulty]);
  return shuffle(pairs.flatMap((pair) => [
    { cardId: `${pair.id}-term`, pairId: pair.id, label: pair.term, kind: 'term' as const },
    { cardId: `${pair.id}-match`, pairId: pair.id, label: pair.match, kind: 'match' as const },
  ]));
}

function buildMathProblem() {
  const left = Math.floor(Math.random() * 10) + 4;
  const right = Math.floor(Math.random() * 8) + 3;
  const operations = [
    { symbol: '+', answer: left + right },
    { symbol: '-', answer: left + right - right },
    { symbol: 'x', answer: left * right },
  ];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const question = operation.symbol === '-'
    ? `${left + right} - ${right}`
    : `${left} ${operation.symbol} ${right}`;
  const choices = shuffle([
    operation.answer,
    operation.answer + 2,
    Math.max(1, operation.answer - 3),
    operation.answer + 5,
  ]);

  return {
    question,
    answer: operation.answer,
    choices,
  };
}

function GamesBanner({ isUniversityPortal }: { isUniversityPortal: boolean }) {
  return (
    <div className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white">
        <Gamepad2 size={24} />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-400">
        {isUniversityPortal ? 'University Game Lab' : 'Social Games'}
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">
        {isUniversityPortal ? 'University challenge modes' : 'Learning games'}
      </h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
        {isUniversityPortal
          ? 'Train recall, argument structure, timed decision-making, and degree-level study skills with university-focused game modes.'
          : 'Practice recall, matching, and study structure with quick interactive games.'}
      </p>
    </div>
  );
}

export default function GamesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const isUniversityPortal = activePortal === 'university';
  const games = isUniversityPortal ? [
    {
      title: 'Concept Decks',
      subtitle: 'Concept recall',
      description: 'Train fast recall for theories, definitions, methods, and lecture concepts in a university-style memory round.',
      icon: Brain,
      path: studentPortalPath(activePortal, '/games/memory-cards'),
      accent: 'bg-indigo-600',
      soft: 'bg-indigo-50',
      text: 'text-indigo-600',
    },
    {
      title: 'Case Matrix',
      subtitle: 'Build reasoning',
      description: 'Work through more mature case-style logic, research judgment, and structured academic reasoning.',
      icon: Leaf,
      path: studentPortalPath(activePortal, '/games/knowledge-tree'),
      accent: 'bg-emerald-600',
      soft: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
    {
      title: 'Quiz Battle',
      subtitle: 'Timed pressure',
      description: 'Run fast university-level quiz rounds and push for a stronger score under time pressure.',
      icon: Trophy,
      path: studentPortalPath(activePortal, '/quiz-game'),
      accent: 'bg-amber-600',
      soft: 'bg-amber-50',
      text: 'text-amber-600',
    },
    {
      title: 'Exam Sprint',
      subtitle: 'Mock question run',
      description: 'Turn a topic into a short, exam-style practice sprint for tutorials, lectures, and revision blocks.',
      icon: Timer,
      path: studentPortalToolPath(activePortal, 'practice-quiz'),
      accent: 'bg-rose-600',
      soft: 'bg-rose-50',
      text: 'text-rose-600',
    },
    {
      title: 'Research Relay',
      subtitle: 'Source strategy',
      description: 'Jump into research mode and treat source-finding like a fast challenge for assignments and reports.',
      icon: Sparkles,
      path: studentPortalToolPath(activePortal, 'research-desk'),
      accent: 'bg-violet-600',
      soft: 'bg-violet-50',
      text: 'text-violet-600',
    },
    {
      title: 'Question Decoder',
      subtitle: 'Assignment prompts',
      description: 'Break down dense university prompts into command words, deliverables, and a clearer response plan.',
      icon: CheckCircle2,
      path: studentPortalToolPath(activePortal, 'question-breakdown'),
      accent: 'bg-cyan-600',
      soft: 'bg-cyan-50',
      text: 'text-cyan-600',
    },
    {
      title: 'Space Knowledge Quest',
      subtitle: 'Discovery run',
      description: 'Use a deeper discovery game as a reset between heavy study blocks and long assignment sessions.',
      icon: Rocket,
      path: studentPortalPath(activePortal, '/games/space-quest'),
      accent: 'bg-slate-900',
      soft: 'bg-slate-100',
      text: 'text-slate-700',
    },
    {
      title: 'Project Velocity',
      subtitle: 'Team challenge',
      description: 'Open the teamwork workspace and treat group planning, meetings, and deliverables like a live project gameboard.',
      icon: Car,
      path: studentPortalToolPath(activePortal, 'teamwork'),
      accent: 'bg-red-600',
      soft: 'bg-red-50',
      text: 'text-red-600',
    },
    {
      title: 'Knowledge Atlas',
      subtitle: 'Big-picture links',
      description: 'Play polished cross-discipline trivia rounds that feel closer to strategy, theory, and professional knowledge.',
      icon: Map,
      path: studentPortalPath(activePortal, '/games/atlas-adventure'),
      accent: 'bg-lime-700',
      soft: 'bg-lime-50',
      text: 'text-lime-700',
    },
    {
      title: 'Trivia Run',
      subtitle: 'Temple sprint',
      description: 'Run a fast arcade trivia round where right answers multiply your squad and wrong answers cut your run short.',
      icon: Zap,
      path: studentPortalPath(activePortal, '/games/trivia-run'),
      accent: 'bg-fuchsia-700',
      soft: 'bg-fuchsia-50',
      text: 'text-fuchsia-700',
    },
  ] : [
    {
      title: 'Memory Cards',
      subtitle: 'Match concepts',
      description: 'Choose a topic and difficulty, then match terms with meanings.',
      icon: Brain,
      path: studentPortalPath(activePortal, '/games/memory-cards'),
      accent: 'bg-indigo-600',
      soft: 'bg-indigo-50',
      text: 'text-indigo-600',
    },
    {
      title: 'Knowledge Tree',
      subtitle: 'Grow mastery',
      description: 'Unlock each node by answering short knowledge questions.',
      icon: Leaf,
      path: studentPortalPath(activePortal, '/games/knowledge-tree'),
      accent: 'bg-emerald-600',
      soft: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
    {
      title: 'Quiz Battle',
      subtitle: 'Beat the clock',
      description: 'Answer rapid-fire questions and push for a stronger score each round.',
      icon: Trophy,
      path: studentPortalPath(activePortal, '/quiz-game'),
      accent: 'bg-amber-600',
      soft: 'bg-amber-50',
      text: 'text-amber-600',
    },
    {
      title: 'Practice Sprint',
      subtitle: 'Quick quiz mode',
      description: 'Turn a topic into a short practice run for fast revision.',
      icon: Timer,
      path: studentPortalToolPath(activePortal, 'practice-quiz'),
      accent: 'bg-rose-600',
      soft: 'bg-rose-50',
      text: 'text-rose-600',
    },
    {
      title: 'Mind Map Quest',
      subtitle: 'Connect ideas',
      description: 'Build visual links between concepts so the whole topic is easier to remember.',
      icon: Sparkles,
      path: studentPortalToolPath(activePortal, 'mind-maps'),
      accent: 'bg-violet-600',
      soft: 'bg-violet-50',
      text: 'text-violet-600',
    },
    {
      title: 'Question Breaker',
      subtitle: 'Decode prompts',
      description: 'Break down tricky questions into clues, actions, and next steps.',
      icon: CheckCircle2,
      path: studentPortalToolPath(activePortal, 'question-breakdown'),
      accent: 'bg-cyan-600',
      soft: 'bg-cyan-50',
      text: 'text-cyan-600',
    },
    {
      title: 'Space Knowledge Quest',
      subtitle: 'Planet explorer',
      description: 'Fly across the Solar System, unlock planets, and collect space facts.',
      icon: Rocket,
      path: studentPortalPath(activePortal, '/games/space-quest'),
      accent: 'bg-slate-900',
      soft: 'bg-slate-100',
      text: 'text-slate-700',
    },
    {
      title: 'Math Racer',
      subtitle: 'Power-up racing',
      description: 'Race around the track and solve quick maths to activate boosts.',
      icon: Car,
      path: studentPortalPath(activePortal, '/games/math-racer'),
      accent: 'bg-red-600',
      soft: 'bg-red-50',
      text: 'text-red-600',
    },
    {
      title: 'Atlas Adventure',
      subtitle: 'Map quest',
      description: 'Explore biomes, answer knowledge clues, and collect explorer badges.',
      icon: Map,
      path: studentPortalPath(activePortal, '/games/atlas-adventure'),
      accent: 'bg-lime-700',
      soft: 'bg-lime-50',
      text: 'text-lime-700',
    },
  ];

  return (
    <div className="space-y-6">
      <GamesBanner isUniversityPortal={isUniversityPortal} />

      <div className="grid gap-6 md:grid-cols-2">
        {games.map((game) => {
          const Icon = game.icon;
          return (
            <button
              key={game.title}
              type="button"
              onClick={() => navigate(game.path)}
              className="group min-h-72 rounded-[32px] border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${game.soft} ${game.text}`}>
                <Icon size={28} />
              </div>
              <div className="mt-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{game.subtitle}</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-900">{game.title}</h2>
                <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-zinc-500">{game.description}</p>
              </div>
              <div className={`mt-8 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition group-hover:scale-[1.02] ${game.accent}`}>
                Open Game
                <Play size={16} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MemoryCardsGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const isUniversityPortal = activePortal === 'university';
  const gameHubPath = studentPortalPath(activePortal, '/games');
  const topicOptions = isUniversityPortal ? universityMemoryTopicIds : highSchoolMemoryTopicIds;
  const initialTopic: MemoryTopic = isUniversityPortal ? 'business' : 'science';
  const [topic, setTopic] = useState<MemoryTopic>(initialTopic);
  const [difficulty, setDifficulty] = useState<MemoryDifficulty>('standard');
  const [deck, setDeck] = useState(() => buildMemoryDeck(initialTopic, 'standard'));
  const [hasStarted, setHasStarted] = useState(false);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);

  const matchedSet = useMemo(() => new Set(matched), [matched]);
  const flippedSet = useMemo(() => new Set(flipped), [flipped]);
  const matchTarget = difficultyPairs[difficulty];
  const memoryComplete = matched.length === matchTarget;

  const startRound = () => {
    setDeck(buildMemoryDeck(topic, difficulty));
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setHasStarted(true);
  };

  const handleMemoryFlip = (cardId: string) => {
    const card = deck.find((item) => item.cardId === cardId);
    if (!card || matchedSet.has(card.pairId) || flippedSet.has(cardId) || flipped.length === 2) return;

    const nextFlipped = [...flipped, cardId];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves((value) => value + 1);
      const [firstId, secondId] = nextFlipped;
      const first = deck.find((item) => item.cardId === firstId);
      const second = deck.find((item) => item.cardId === secondId);

      if (first && second && first.pairId === second.pairId && first.kind !== second.kind) {
        setTimeout(() => {
          setMatched((items) => [...items, first.pairId]);
          setFlipped([]);
        }, 500);
      } else {
        setTimeout(() => setFlipped([]), 850);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(gameHubPath)}
            className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={16} />
            Games
          </button>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <Brain size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-400">{isUniversityPortal ? 'Concept Decks' : 'Memory Cards'}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">
            {isUniversityPortal ? 'Run a university concept deck' : 'Set up your matching round'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
            {isUniversityPortal
              ? 'Choose a domain and round depth, then match terms with sharper theory, method, and strategy definitions.'
              : 'Choose a topic and round size, then flip cards to match each term with its meaning.'}
          </p>
        </div>
        <button
          type="button"
          onClick={startRound}
          className="flex h-12 w-fit items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
        >
          {hasStarted ? <RotateCcw size={16} /> : <Play size={16} />}
          {hasStarted ? (isUniversityPortal ? 'Restart Deck' : 'Restart Round') : (isUniversityPortal ? 'Launch Deck' : 'Start Round')}
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-zinc-950">{isUniversityPortal ? 'Deck setup' : 'Game setup'}</h2>
          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">{isUniversityPortal ? 'Domain' : 'Topic'}</label>
              <div className="grid gap-2">
                {topicOptions.map((topicId) => (
                  <button
                    key={topicId}
                    type="button"
                    onClick={() => setTopic(topicId)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      topic === topicId ? 'border-indigo-300 bg-indigo-50' : 'border-zinc-100 bg-zinc-50 hover:bg-white',
                    )}
                  >
                    <p className="text-sm font-black text-zinc-950">{memoryTopics[topicId].label}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">{memoryTopics[topicId].description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">Difficulty</label>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as MemoryDifficulty)}
                className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 outline-none focus:border-indigo-300"
              >
                <option value="quick">{isUniversityPortal ? 'Brief - 4 pairs' : 'Quick - 4 pairs'}</option>
                <option value="standard">Standard - 6 pairs</option>
                <option value="challenge">{isUniversityPortal ? 'Deep - 8 pairs' : 'Challenge - 8 pairs'}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-indigo-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Matches</p>
                <p className="mt-1 text-3xl font-black text-indigo-900">{matched.length}/{matchTarget}</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Moves</p>
                <p className="mt-1 text-3xl font-black text-zinc-950">{moves}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          {!hasStarted ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
              <Sparkles className="mb-4 h-10 w-10 text-indigo-500" />
              <h2 className="text-2xl font-black text-zinc-950">{isUniversityPortal ? 'Choose your deck, then launch.' : 'Choose your setup, then start.'}</h2>
              <p className="mt-3 max-w-lg text-sm font-semibold leading-6 text-zinc-500">
                {isUniversityPortal
                  ? 'The round will generate from your selected domain and depth.'
                  : 'The board will generate from your selected topic and difficulty.'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-zinc-950">{memoryTopics[topic].label} {isUniversityPortal ? 'Concept Deck' : 'Memory Cards'}</h2>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">{isUniversityPortal ? 'Match terms to their strongest definitions.' : 'Flip cards to match terms with meanings.'}</p>
                </div>
                {memoryComplete ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                    <Trophy size={18} />
                    {isUniversityPortal ? 'Deck complete' : 'Complete'}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {deck.map((card) => {
                  const isFaceUp = flippedSet.has(card.cardId) || matchedSet.has(card.pairId);
                  const isMatched = matchedSet.has(card.pairId);
                  return (
                    <button
                      key={card.cardId}
                      type="button"
                      onClick={() => handleMemoryFlip(card.cardId)}
                      className={cn(
                        'flex aspect-[4/3] items-center justify-center rounded-2xl border p-4 text-center text-sm font-black leading-5 transition',
                        isFaceUp
                          ? isMatched
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-indigo-200 bg-indigo-50 text-indigo-900'
                          : 'border-zinc-200 bg-zinc-900 text-white hover:-translate-y-0.5 hover:shadow-lg',
                      )}
                    >
                      {isFaceUp ? card.label : <Sparkles size={24} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export function KnowledgeTreeGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const isUniversityPortal = activePortal === 'university';
  const gameHubPath = studentPortalPath(activePortal, '/games');
  const treeTopics = isUniversityPortal ? universityTreeTopics : highSchoolTreeTopics;
  const [topicIndex, setTopicIndex] = useState(0);
  const [treeIndex, setTreeIndex] = useState(0);
  const [unlockedTreeNodes, setUnlockedTreeNodes] = useState<string[]>([]);
  const [selectedTreeAnswer, setSelectedTreeAnswer] = useState('');
  const [treeFeedback, setTreeFeedback] = useState('');

  const activeTopic = treeTopics[topicIndex];
  const currentTreeNode = activeTopic.nodes[treeIndex];
  const treeComplete = unlockedTreeNodes.length === activeTopic.nodes.length;

  const chooseTopic = (index: number) => {
    setTopicIndex(index);
    setTreeIndex(0);
    setUnlockedTreeNodes([]);
    setSelectedTreeAnswer('');
    setTreeFeedback('');
  };

  const submitTreeAnswer = (answer: string) => {
    setSelectedTreeAnswer(answer);
    if (answer !== currentTreeNode.answer) {
      setTreeFeedback(isUniversityPortal ? 'Not quite. Choose the option with the strongest analytical logic.' : 'Try again. Look for the option that supports clear study structure.');
      return;
    }

    setTreeFeedback(currentTreeNode.reward);
    setUnlockedTreeNodes((items) => items.includes(currentTreeNode.id) ? items : [...items, currentTreeNode.id]);
  };

  const nextTreeQuestion = () => {
    setTreeIndex((index) => Math.min(index + 1, activeTopic.nodes.length - 1));
    setSelectedTreeAnswer('');
    setTreeFeedback('');
  };

  const resetTree = () => {
    setTreeIndex(0);
    setUnlockedTreeNodes([]);
    setSelectedTreeAnswer('');
    setTreeFeedback('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(gameHubPath)}
            className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={16} />
            Games
          </button>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Leaf size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-400">{isUniversityPortal ? 'Case Matrix' : 'Knowledge Tree'}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">{isUniversityPortal ? 'Run a sharper reasoning round' : 'Grow your study tree'}</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
            {isUniversityPortal
              ? 'Choose a university topic track, work through each prompt, and unlock better case and research judgment.'
              : 'Choose a topic, answer each node, and unlock the full tree.'}
          </p>
        </div>
        <button
          type="button"
          onClick={resetTree}
          className="flex h-12 w-fit items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-600 hover:bg-zinc-50"
        >
          <RotateCcw size={16} />
          {isUniversityPortal ? 'Reset Round' : 'Reset Tree'}
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-zinc-950">{isUniversityPortal ? 'Choose track' : 'Choose topic'}</h2>
          <div className="mt-5 space-y-3">
            {treeTopics.map((topic, index) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => chooseTopic(index)}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition',
                  topicIndex === index ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-100 bg-zinc-50 hover:bg-white',
                )}
              >
                <p className="text-sm font-black text-zinc-950">{topic.label}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">{topic.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {activeTopic.nodes.map((node, index) => {
              const unlocked = unlockedTreeNodes.includes(node.id);
              const active = index === treeIndex;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    setTreeIndex(index);
                    setSelectedTreeAnswer('');
                    setTreeFeedback('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition',
                    active ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-100 bg-zinc-50 hover:bg-white',
                  )}
                >
                  <span className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    unlocked ? 'bg-emerald-600 text-white' : 'bg-white text-zinc-400',
                  )}>
                    {unlocked ? <CheckCircle2 size={18} /> : <Leaf size={18} />}
                  </span>
                  <span>
                    <span className="block text-sm font-black text-zinc-900">{node.title}</span>
                    <span className="text-xs font-semibold text-zinc-500">{unlocked ? 'Unlocked' : isUniversityPortal ? 'Locked by prompt' : 'Locked by question'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">{isUniversityPortal ? 'Prompt' : 'Question'} {treeIndex + 1} of {activeTopic.nodes.length}</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">{currentTreeNode.title}</h3>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-500">
              <Timer size={16} />
              {isUniversityPortal ? 'Reasoning round' : 'Quick round'}
            </div>
          </div>

          <div className="rounded-3xl bg-zinc-50 p-6">
            <p className="text-xl font-black leading-8 text-zinc-950">{currentTreeNode.prompt}</p>
            <div className="mt-6 grid gap-3">
              {currentTreeNode.options.map((option) => {
                const isSelected = selectedTreeAnswer === option;
                const isCorrect = option === currentTreeNode.answer && treeFeedback === currentTreeNode.reward;
                const isWrong = isSelected && option !== currentTreeNode.answer;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => submitTreeAnswer(option)}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border bg-white p-4 text-left text-sm font-black transition hover:border-emerald-200',
                      isCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-800',
                      isWrong && 'border-rose-300 bg-rose-50 text-rose-700',
                    )}
                  >
                    {option}
                    {isCorrect ? <CheckCircle2 size={18} /> : isWrong ? <XCircle size={18} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {treeFeedback ? (
            <div className={cn(
              'mt-5 rounded-3xl border p-5 text-sm font-bold leading-6',
              treeFeedback === currentTreeNode.reward
                ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border-amber-100 bg-amber-50 text-amber-800',
            )}>
              {treeFeedback}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-zinc-500">{unlockedTreeNodes.length}/{activeTopic.nodes.length} {isUniversityPortal ? 'steps unlocked' : 'nodes unlocked'}</p>
            <button
              type="button"
              onClick={nextTreeQuestion}
              disabled={!unlockedTreeNodes.includes(currentTreeNode.id) || treeIndex === activeTopic.nodes.length - 1}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
            >
              {isUniversityPortal ? 'Next step' : 'Next Node'}
            </button>
          </div>

          {treeComplete ? (
            <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-900">
              <Trophy className="mb-2 h-7 w-7" />
              <p className="text-lg font-black">{isUniversityPortal ? 'Case matrix complete.' : 'Knowledge tree complete.'}</p>
              <p className="mt-1 text-sm font-semibold">{isUniversityPortal ? 'You completed every reasoning step in this university round.' : 'You unlocked every study structure node.'}</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function SpaceKnowledgeQuestGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const gameHubPath = studentPortalPath(activePortal, '/games');
  const [planetIndex, setPlanetIndex] = useState(0);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [feedback, setFeedback] = useState('');

  const currentPlanet = spaceStops[planetIndex];
  const complete = discovered.length === spaceStops.length;

  const choosePlanet = (index: number) => {
    setPlanetIndex(index);
    setSelectedAnswer('');
    setFeedback('');
  };

  const submitAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    if (answer !== currentPlanet.answer) {
      setFeedback('Not quite. Use the planet clue, then try another answer.');
      return;
    }

    setFeedback(currentPlanet.fact);
    setDiscovered((items) => items.includes(currentPlanet.id) ? items : [...items, currentPlanet.id]);
  };

  const nextPlanet = () => {
    const nextIndex = Math.min(planetIndex + 1, spaceStops.length - 1);
    choosePlanet(nextIndex);
  };

  const resetQuest = () => {
    setPlanetIndex(0);
    setDiscovered([]);
    setSelectedAnswer('');
    setFeedback('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(gameHubPath)}
            className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={16} />
            Games
          </button>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Rocket size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-400">Space Knowledge Quest</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">Fly the Solar System</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
            Pilot your ship from planet to planet. Answer each space clue to unlock a discovery log.
          </p>
        </div>
        <button
          type="button"
          onClick={resetQuest}
          className="flex h-12 w-fit items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-600 hover:bg-zinc-50"
        >
          <RotateCcw size={16} />
          Reset Quest
        </button>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-[32px] border border-zinc-200 bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">Flight map</p>
              <h2 className="mt-2 text-3xl font-black">{currentPlanet.name}</h2>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black">
              <Trophy size={16} />
              {discovered.length}/{spaceStops.length} discoveries
            </div>
          </div>

          <div className="mt-8 grid min-h-[420px] gap-4 md:grid-cols-5">
            {spaceStops.map((planet, index) => {
              const active = index === planetIndex;
              const found = discovered.includes(planet.id);
              return (
                <button
                  key={planet.id}
                  type="button"
                  onClick={() => choosePlanet(index)}
                  className={cn(
                    'flex min-h-64 flex-col items-center justify-between rounded-3xl border p-4 text-center transition',
                    active ? 'border-sky-300 bg-sky-400/20' : 'border-white/10 bg-white/5 hover:bg-white/10',
                  )}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg">
                    {found ? <CheckCircle2 size={28} /> : <Rocket size={28} />}
                  </span>
                  <span>
                    <span className="block text-lg font-black">{planet.name}</span>
                    <span className="mt-2 block text-xs font-bold leading-5 text-slate-300">{found ? 'Discovery logged' : 'Clue locked'}</span>
                  </span>
                  {active ? <span className="rounded-full bg-sky-300 px-3 py-1 text-xs font-black text-slate-950">Current stop</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Compass size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Planet clue</p>
              <h3 className="text-xl font-black text-zinc-950">{currentPlanet.name}</h3>
            </div>
          </div>
          <p className="mt-5 rounded-3xl bg-zinc-50 p-5 text-sm font-bold leading-6 text-zinc-600">{currentPlanet.clue}</p>
          <p className="mt-5 text-lg font-black leading-7 text-zinc-950">{currentPlanet.prompt}</p>
          <div className="mt-4 grid gap-3">
            {currentPlanet.options.map((option) => {
              const correct = option === currentPlanet.answer && feedback === currentPlanet.fact;
              const wrong = selectedAnswer === option && option !== currentPlanet.answer;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => submitAnswer(option)}
                  className={cn(
                    'rounded-2xl border border-zinc-200 p-4 text-left text-sm font-black text-zinc-700 transition hover:border-sky-200 hover:bg-sky-50',
                    correct && 'border-emerald-300 bg-emerald-50 text-emerald-800',
                    wrong && 'border-rose-300 bg-rose-50 text-rose-700',
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {feedback ? (
            <div className={cn(
              'mt-5 rounded-3xl border p-5 text-sm font-bold leading-6',
              feedback === currentPlanet.fact ? 'border-sky-100 bg-sky-50 text-sky-900' : 'border-amber-100 bg-amber-50 text-amber-800',
            )}>
              {feedback}
            </div>
          ) : null}

          <button
            type="button"
            onClick={nextPlanet}
            disabled={!discovered.includes(currentPlanet.id) || planetIndex === spaceStops.length - 1}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <Rocket size={16} />
            Warp to next planet
          </button>

          {complete ? (
            <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-900">
              <Trophy className="mb-2 h-7 w-7" />
              <p className="text-lg font-black">Solar quest complete.</p>
              <p className="mt-1 text-sm font-semibold">Every planet stop has a discovery in your log.</p>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

export function MathRacerGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const gameHubPath = studentPortalPath(activePortal, '/games');
  const [problem, setProblem] = useState(() => buildMathProblem());
  const [distance, setDistance] = useState(18);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState('Solve the power-up problem to move your racer.');

  const finished = distance >= 100;

  const answerProblem = (choice: number) => {
    if (finished) return;

    if (choice === problem.answer) {
      const boost = streak >= 2 ? 18 : 12;
      setDistance((value) => Math.min(100, value + boost));
      setScore((value) => value + 100 + streak * 25);
      setStreak((value) => value + 1);
      setMessage(streak >= 2 ? 'Turbo boost activated. Correct streak bonus.' : 'Power-up collected. Keep racing.');
    } else {
      setStreak(0);
      setDistance((value) => Math.max(8, value - 5));
      setMessage('Power-up missed. The racer slowed down, but you can recover.');
    }

    setProblem(buildMathProblem());
  };

  const resetRace = () => {
    setProblem(buildMathProblem());
    setDistance(18);
    setScore(0);
    setStreak(0);
    setMessage('Solve the power-up problem to move your racer.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(gameHubPath)}
            className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={16} />
            Games
          </button>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white">
            <Car size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-400">Math Racer</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">Race for power-ups</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
            Every correct quick-math answer charges your engine. Streaks unlock bigger boosts.
          </p>
        </div>
        <button
          type="button"
          onClick={resetRace}
          className="flex h-12 w-fit items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-600 hover:bg-zinc-50"
        >
          <RotateCcw size={16} />
          Restart Race
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">Speedway</p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950">Power-up track</h2>
            </div>
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">
              Score {score}
            </div>
          </div>

          <div className="mt-8 rounded-[32px] bg-zinc-950 p-5">
            <div className="relative h-72 overflow-hidden rounded-3xl bg-zinc-900">
              <div className="absolute left-0 right-0 top-1/2 h-20 -translate-y-1/2 bg-zinc-800" />
              <div className="absolute left-6 right-6 top-1/2 h-1 -translate-y-1/2 border-t-4 border-dashed border-yellow-300" />
              <div className="absolute bottom-8 left-6 right-6 h-3 rounded-full bg-white/10">
                <div className="h-3 rounded-full bg-red-500 transition-all" style={{ width: `${distance}%` }} />
              </div>
              <div
                className="absolute top-1/2 flex h-16 w-20 -translate-y-1/2 items-center justify-center rounded-3xl bg-red-500 text-white shadow-2xl transition-all"
                style={{ left: `calc(${distance}% - 40px)` }}
              >
                <Car size={34} />
              </div>
              <div className="absolute right-6 top-8 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950">
                <Flag size={16} />
                Finish
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-3xl bg-zinc-50 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Distance</p>
              <p className="mt-1 text-3xl font-black text-zinc-950">{distance}%</p>
            </div>
            <div className="rounded-3xl bg-red-50 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-red-500">Streak</p>
              <p className="mt-1 text-3xl font-black text-red-800">{streak}</p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-amber-600">Boost</p>
              <p className="mt-1 text-3xl font-black text-amber-800">{streak >= 2 ? 'Turbo' : 'Nitro'}</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Zap size={24} />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-zinc-400">Power-up problem</p>
          <h3 className="mt-2 text-4xl font-black tracking-tight text-zinc-950">{problem.question}</h3>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {problem.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => answerProblem(choice)}
                disabled={finished}
                className="flex h-20 items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50 text-2xl font-black text-zinc-950 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                {choice}
              </button>
            ))}
          </div>
          <p className="mt-5 rounded-3xl bg-zinc-50 p-5 text-sm font-bold leading-6 text-zinc-600">{finished ? 'Race complete. Restart to try for a higher score.' : message}</p>
          {finished ? (
            <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-900">
              <Trophy className="mb-2 h-7 w-7" />
              <p className="text-lg font-black">You crossed the finish line.</p>
              <p className="mt-1 text-sm font-semibold">Final score: {score}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

export function AtlasAdventureGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const isUniversityPortal = activePortal === 'university';
  const gameHubPath = studentPortalPath(activePortal, '/games');
  const atlasStops = isUniversityPortal ? universityAtlasStops : highSchoolAtlasStops;
  const [stopIndex, setStopIndex] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState('');

  const activeStop = atlasStops[stopIndex];
  const complete = badges.length === atlasStops.length;

  const chooseStop = (index: number) => {
    setStopIndex(index);
    setSelected('');
    setFeedback('');
  };

  const submitAnswer = (answer: string) => {
    setSelected(answer);
    if (answer !== activeStop.answer) {
      setFeedback(isUniversityPortal ? 'Try again. The clue points toward the strongest conceptual interpretation.' : 'Try again. The map clue points toward the ecosystem role.');
      return;
    }

    setFeedback(activeStop.reward);
    setBadges((items) => items.includes(activeStop.id) ? items : [...items, activeStop.id]);
  };

  const resetAdventure = () => {
    setStopIndex(0);
    setBadges([]);
    setSelected('');
    setFeedback('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(gameHubPath)}
            className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={16} />
            Games
          </button>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-700 text-white">
            <Map size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-400">{isUniversityPortal ? 'Knowledge Atlas' : 'Atlas Adventure'}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">{isUniversityPortal ? 'Run a polished cross-discipline trivia map' : 'Explore the knowledge map'}</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
            {isUniversityPortal
              ? 'Move across stronger university domains, solve concise theory and strategy prompts, and log each insight.'
              : 'Move across the atlas, solve each nature clue, and collect explorer badges.'}
          </p>
        </div>
        <button
          type="button"
          onClick={resetAdventure}
          className="flex h-12 w-fit items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-600 hover:bg-zinc-50"
        >
          <RotateCcw size={16} />
          {isUniversityPortal ? 'Reset Atlas' : 'Reset Map'}
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <aside className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-700">{isUniversityPortal ? 'Knowledge map' : 'Explorer map'}</p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950">{isUniversityPortal ? 'Insight route' : 'Badge route'}</h2>
            </div>
            <div className="rounded-2xl bg-lime-50 px-4 py-3 text-sm font-black text-lime-800">
              {badges.length}/{atlasStops.length}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {atlasStops.map((stop, index) => {
              const active = index === stopIndex;
              const collected = badges.includes(stop.id);
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => chooseStop(index)}
                  className={cn(
                    'flex items-center gap-4 rounded-3xl border p-4 text-left transition',
                    active ? 'border-lime-300 bg-lime-50' : 'border-zinc-100 bg-zinc-50 hover:bg-white',
                  )}
                >
                  <span className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                    collected ? 'bg-lime-700 text-white' : 'bg-white text-zinc-400',
                  )}>
                    {collected ? <CheckCircle2 size={20} /> : <Compass size={20} />}
                  </span>
                  <span>
                    <span className="block text-sm font-black text-zinc-950">{stop.title}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-zinc-500">{collected ? (isUniversityPortal ? 'Insight logged' : 'Badge collected') : stop.clue}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="rounded-[32px] bg-lime-50 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-700">{isUniversityPortal ? 'Current domain' : 'Current location'}</p>
                <h2 className="mt-2 text-3xl font-black text-zinc-950">{activeStop.title}</h2>
                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-zinc-600">{activeStop.clue}</p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-lime-700 shadow-sm">
                <Map size={28} />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[32px] border border-zinc-100 p-6">
            <p className="text-xl font-black leading-8 text-zinc-950">{activeStop.prompt}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {activeStop.options.map((option) => {
                const correct = option === activeStop.answer && feedback === activeStop.reward;
                const wrong = selected === option && option !== activeStop.answer;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => submitAnswer(option)}
                    className={cn(
                      'min-h-24 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-left text-sm font-black leading-6 text-zinc-700 transition hover:border-lime-300 hover:bg-lime-50',
                      correct && 'border-emerald-300 bg-emerald-50 text-emerald-800',
                      wrong && 'border-rose-300 bg-rose-50 text-rose-700',
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {feedback ? (
            <div className={cn(
              'mt-5 rounded-3xl border p-5 text-sm font-bold leading-6',
              feedback === activeStop.reward ? 'border-lime-100 bg-lime-50 text-lime-900' : 'border-amber-100 bg-amber-50 text-amber-800',
            )}>
              {feedback}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-zinc-500">{badges.length} {isUniversityPortal ? 'insights logged' : 'explorer badges collected'}</p>
            <button
              type="button"
              onClick={() => chooseStop(Math.min(stopIndex + 1, atlasStops.length - 1))}
              disabled={!badges.includes(activeStop.id) || stopIndex === atlasStops.length - 1}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-lime-700 px-5 text-sm font-black text-white hover:bg-lime-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              <Compass size={16} />
              {isUniversityPortal ? 'Open next domain' : 'Follow next marker'}
            </button>
          </div>

          {complete ? (
            <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-900">
              <Trophy className="mb-2 h-7 w-7" />
              <p className="text-lg font-black">{isUniversityPortal ? 'Knowledge atlas complete.' : 'Atlas adventure complete.'}</p>
              <p className="mt-1 text-sm font-semibold">{isUniversityPortal ? 'You logged every domain insight in this round.' : 'You collected every ecosystem badge on the map.'}</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function TriviaRunGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const gameHubPath = studentPortalPath(activePortal, '/games');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(gameHubPath)}
            className="mb-4 flex items-center gap-2 text-sm font-black text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={16} />
            Games
          </button>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-700 text-white">
            <Zap size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-400">Trivia Run</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">Temple sprint trivia</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
            Answer quickly, multiply your squad, and keep the run alive. This is an arcade-style trivia mode added to the university games hub.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-zinc-200 bg-white p-2 shadow-sm">
        <iframe
          title="Trivia Run"
          srcDoc={TRIVIA_RUN_HTML}
          className="h-[78vh] w-full rounded-[28px] border-0"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
