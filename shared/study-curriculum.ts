export const STUDY_PASS_ACCURACY = 95;
export const STUDY_ROUND_MIN_CHARACTERS = 40;
export const STUDY_ROUND_MAX_CHARACTERS = 60;

export type StudyLanguage = 'english' | 'thai';

export type StudyLesson = {
  id: string;
  language: StudyLanguage;
  title: string;
  focus: string;
  rounds: string[];
  checkpoint: boolean;
};

export type StudyLevel = {
  id: string;
  language: StudyLanguage;
  title: string;
  description: string;
  lessons: StudyLesson[];
};

type LessonSeed = Omit<
  StudyLesson,
  'id' | 'language' | 'rounds' | 'checkpoint'
> & {
  id: string;
  tokens: string[];
};

type LevelSeed = Omit<StudyLevel, 'id' | 'language' | 'lessons'> & {
  id: string;
  lessons: LessonSeed[];
};

function l(
  id: string,
  title: string,
  focus: string,
  tokens: string | string[],
): LessonSeed {
  return {
    id,
    title,
    focus,
    tokens: typeof tokens === 'string' ? tokens.split(' ') : tokens,
  };
}

export function countStudyCharacters(content: string) {
  return Array.from(content).filter((character) => !/\s/u.test(character))
    .length;
}

function buildRound(tokens: string[], offset: number) {
  const selected: string[] = [];
  let count = 0;
  let cursor = 0;
  let consecutiveSkips = 0;
  while (count < 46) {
    const token = tokens[(cursor + offset) % tokens.length];
    const tokenLength = countStudyCharacters(token);
    if (count + tokenLength <= 58) {
      selected.push(token);
      count += tokenLength;
      consecutiveSkips = 0;
    } else {
      consecutiveSkips += 1;
    }
    cursor += 1;
    if (consecutiveSkips >= tokens.length && count >= 40) break;
    if (cursor > 1_000) {
      throw new Error(
        `Unable to build a study round within the size limit: ${tokens.join(' ')}`,
      );
    }
  }
  return selected.join(' ');
}

const ENGLISH_LEVEL_SEEDS: LevelSeed[] = [
  {
    id: 'home-row',
    title: 'Home row',
    description: 'Build the anchor positions before reaching away from home.',
    lessons: [
      l(
        'home-anchors',
        'F and J anchors',
        'Index-finger anchors',
        'fff jjj fjf jfj ffj jjf',
      ),
      l('home-middle', 'D and K', 'Middle fingers', 'ddd kkk dkd kdk fdf jkj'),
      l('home-ring', 'S and L', 'Ring fingers', 'sss lll sls lsl dsd klk'),
      l(
        'home-pinky',
        'A and semicolon',
        'Pinky fingers',
        'aaa ;;; a;a ;a; sas l;l',
      ),
      l(
        'home-inner',
        'G and H',
        'Inner index reaches',
        'fgf jhj ghg hgh fgh hgf',
      ),
      l(
        'home-left-flow',
        'Left-hand flow',
        'A S D F G combinations',
        'asdf fdsa sdfg gfds adfg gsfa',
      ),
      l(
        'home-right-flow',
        'Right-hand flow',
        'H J K L ; combinations',
        'hjkl ;lkj jkl; lkjh h;kj jl;h',
      ),
      l(
        'home-alternation',
        'Hand alternation',
        'Balanced left-right motion',
        'fj dk sl a; gh jf kd ls',
      ),
      l(
        'home-spacing',
        'Space rhythm',
        'Thumb timing between groups',
        'fad lad ask had fall dash flask',
      ),
      l(
        'home-words',
        'Home-row words',
        'Frequent home-row shapes',
        'sad fall ask dad flask salad half',
      ),
      l('home-phrases', 'Home-row phrases', 'Steady spacing and flow', [
        'a sad lad',
        'ask dad',
        'a glass flask',
        'fall as a lad',
      ]),
    ],
  },
  {
    id: 'top-row',
    title: 'Top row',
    description: 'Reach upward, then return each finger to the home row.',
    lessons: [
      l(
        'top-qw',
        'Q and W',
        'Left pinky and ring reaches',
        'aqa sws qwq wqw was saw',
      ),
      l('top-e', 'E reach', 'Left middle finger', 'ded ede fee see ease seed'),
      l('top-rt', 'R and T', 'Left index reaches', 'frf ftf rtr trt rest fast'),
      l('top-yu', 'Y and U', 'Right index reaches', 'jyj juj yuy uyu your use'),
      l('top-i', 'I reach', 'Right middle finger', 'kik iki kid did idea side'),
      l(
        'top-op',
        'O and P',
        'Right ring and pinky reaches',
        'lol ;p; opo pop pool loop',
      ),
      l(
        'top-left-flow',
        'Left top-row flow',
        'Q W E R T with home row',
        'qwer rewq wert trew stew draft',
      ),
      l(
        'top-right-flow',
        'Right top-row flow',
        'Y U I O P with home row',
        'yuio oiuy uiop poiu your pilot',
      ),
      l(
        'top-alternation',
        'Top-row alternation',
        'Switch hands without rushing',
        'qt wy eu ri to yp write',
      ),
      l(
        'top-words',
        'Top-row words',
        'Words across both hands',
        'we were quiet type your reply',
      ),
      l(
        'top-home-mix',
        'Top and home mix',
        'Return to home after each reach',
        'read write start quiet focus steady',
      ),
    ],
  },
  {
    id: 'bottom-row',
    title: 'Bottom row',
    description: 'Reach downward without letting the wrists collapse.',
    lessons: [
      l(
        'bottom-zx',
        'Z and X',
        'Left pinky and ring reaches',
        'aza sxs zxz xzx zip box',
      ),
      l('bottom-c', 'C reach', 'Left middle finger', 'dcd cdc can cab ice act'),
      l(
        'bottom-vb',
        'V and B',
        'Left index reaches',
        'fvf fbf vbv bvb van brave',
      ),
      l(
        'bottom-nm',
        'N and M',
        'Right index reaches',
        'jnj jmj nmn mnm name minimum',
      ),
      l(
        'bottom-comma',
        'Comma reach',
        'Right middle finger',
        'k,k ,k, n,m m,n calm, next,',
      ),
      l(
        'bottom-period',
        'Period reach',
        'Right ring finger',
        'l.l .l. m.m end. calm. move.',
      ),
      l(
        'bottom-slash',
        'Slash reach',
        'Right pinky finger',
        ';/; /;/ m/m n/n yes/no and/or',
      ),
      l(
        'bottom-left-flow',
        'Left bottom-row flow',
        'Z X C V B combinations',
        'zxcv vcxz xcvb bvcx cave exact',
      ),
      l(
        'bottom-right-flow',
        'Right bottom-row flow',
        'N M and punctuation',
        'nm,. .,mn m,./ /.,m minimum moment',
      ),
      l(
        'bottom-words',
        'Bottom-row words',
        'Full alphabet movement',
        'mix calm voice zoom brave next',
      ),
      l(
        'bottom-home-mix',
        'Bottom and home mix',
        'Return upward to home',
        'move calm basic exact zoom finish',
      ),
    ],
  },
  {
    id: 'row-transitions',
    title: 'Row transitions',
    description:
      'Train vertical paths and clean returns across all three rows.',
    lessons: [
      l(
        'column-qaz',
        'Q A Z column',
        'Left pinky vertical path',
        'qaz zaq aqz zqa quiz gaze',
      ),
      l(
        'column-wsx',
        'W S X column',
        'Left ring vertical path',
        'wsx xsw swx xws wax six',
      ),
      l(
        'column-edc',
        'E D C column',
        'Left middle vertical path',
        'edc cde dec ced dice code',
      ),
      l(
        'column-rfv',
        'R F V column',
        'Left index vertical path',
        'rfv vfr frv vrf river favor',
      ),
      l(
        'column-tgb',
        'T G B column',
        'Inner left index path',
        'tgb bgt gtb btg bright begin',
      ),
      l(
        'column-yhn',
        'Y H N column',
        'Inner right index path',
        'yhn nhy hyn nyh handy honey',
      ),
      l(
        'column-ujm',
        'U J M column',
        'Right index vertical path',
        'ujm mju jum muj jump major',
      ),
      l(
        'column-ikc',
        'I K comma path',
        'Right middle vertical path',
        'ik, ,ki ki, ,ik kind, quick,',
      ),
      l(
        'column-olp',
        'O L period path',
        'Right ring vertical path',
        'ol. .lo lo. .ol slow. cool.',
      ),
      l(
        'column-psemi',
        'P and semicolon path',
        'Right pinky vertical path',
        'p;/ /;p ;p/ /p; stop; pause;',
      ),
      l(
        'transition-flow',
        'Three-row flow',
        'Continuous movement between rows',
        'qaz wsx edc rfv yhn ujm ol.',
      ),
    ],
  },
  {
    id: 'common-pairs',
    title: 'Common letter pairs',
    description:
      'Automate frequent English transitions instead of single keys.',
    lessons: [
      l(
        'pairs-th-he',
        'TH and HE',
        'Alternating common pairs',
        'th he the then that these',
      ),
      l(
        'pairs-in-er',
        'IN and ER',
        'Index-to-ring transitions',
        'in er inner enter finger winter',
      ),
      l(
        'pairs-an-re',
        'AN and RE',
        'Cross-hand transitions',
        'an re near learn answer ready',
      ),
      l(
        'pairs-on-at',
        'ON and AT',
        'Right-left alternation',
        'on at tone station motion later',
      ),
      l(
        'pairs-en-nd',
        'EN and ND',
        'Inside-outside movement',
        'en nd end send friend extend',
      ),
      l(
        'pairs-ti-es',
        'TI and ES',
        'Controlled index-ring movement',
        'ti es time test lines steady',
      ),
      l(
        'pairs-or-te',
        'OR and TE',
        'Top-row coordination',
        'or te more note short better',
      ),
      l(
        'pairs-of-ed',
        'OF and ED',
        'Reverse direction changes',
        'of ed soft fixed focused offered',
      ),
      l(
        'pairs-is-it',
        'IS and IT',
        'Compact alternating pairs',
        'is it visit this finish little',
      ),
      l(
        'pairs-al-ar',
        'AL and AR',
        'Left-right outward motion',
        'al ar calm start clear regular',
      ),
      l(
        'pairs-mixed',
        'Mixed common pairs',
        'Blend frequent transitions',
        'the in and more test clear finish',
      ),
    ],
  },
  {
    id: 'words-sentences',
    title: 'Words and sentences',
    description: 'Turn key control into steady, readable English typing.',
    lessons: [
      l(
        'words-short',
        'Short words',
        'Two- and three-letter words',
        'an in to the and for you',
      ),
      l(
        'words-four',
        'Four-letter words',
        'Even rhythm across words',
        'type calm rest hand move slow',
      ),
      l(
        'words-five',
        'Five-letter words',
        'Longer finger sequences',
        'focus clear quick light learn write',
      ),
      l(
        'words-long',
        'Long words',
        'Maintain rhythm through length',
        'accuracy practice regular control progress',
      ),
      l('sentence-calm', 'Calm rhythm', 'Short complete sentences', [
        'Keep a calm rhythm.',
        'Let each finger return.',
        'Stay relaxed.',
      ]),
      l('sentence-focus', 'Focused typing', 'Accuracy-focused sentences', [
        'Focus on each key.',
        'Correct errors calmly.',
        'Accuracy comes first.',
      ]),
      l('sentence-hands', 'Hand position', 'Home-row reminders', [
        'Keep both hands steady.',
        'Return to the home row.',
        'Do not look down.',
      ]),
      l('sentence-speed', 'Controlled speed', 'Build pace without rushing', [
        'Speed follows control.',
        'Keep an even pace.',
        'Slow down to stay exact.',
      ]),
      l('sentence-correction', 'Corrections', 'Recover without losing rhythm', [
        'Notice the error.',
        'Correct it once.',
        'Continue with a calm pace.',
      ]),
      l(
        'sentence-alternation',
        'Sentence alternation',
        'Balanced use of both hands',
        [
          'Write with both hands.',
          'Share the work evenly.',
          'Keep each wrist quiet.',
        ],
      ),
      l('sentence-review', 'Sentence review', 'Mixed sentence practice', [
        'Type clearly and calmly.',
        'Pause, reset, and continue.',
        'Finish with accuracy.',
      ]),
    ],
  },
  {
    id: 'shift-punctuation',
    title: 'Shift and punctuation',
    description:
      'Coordinate the opposite pinky for capitals and sentence marks.',
    lessons: [
      l(
        'shift-left',
        'Left Shift',
        'Capitals typed by the right hand',
        'Jump High Keep Move Jump High Keep Moving',
      ),
      l(
        'shift-right',
        'Right Shift',
        'Capitals typed by the left hand',
        'Fast Steps Calm Hands Fast Steps Calm Hands',
      ),
      l('punctuation-comma', 'Commas', 'Pause without stopping rhythm', [
        'slow, steady',
        'calm, clear',
        'type, check, continue',
      ]),
      l('punctuation-period', 'Periods', 'Finish and restart sentences', [
        'Type well.',
        'Stay calm.',
        'Check once.',
        'Continue.',
      ]),
      l('punctuation-semicolon', 'Semicolons', 'Right-pinky punctuation', [
        'type; check',
        'pause; reset',
        'slow; steady',
        'calm; clear',
      ]),
      l('punctuation-question', 'Question marks', 'Shift plus right pinky', [
        'Ready?',
        'Is it clear?',
        'Can you continue?',
        'Are you calm?',
      ]),
      l(
        'punctuation-apostrophe',
        'Apostrophes',
        'Controlled right-pinky reach',
        ["don't", "it's", "you're", "we'll", "Keep going; don't rush."],
      ),
      l('punctuation-quotes', 'Quotation marks', 'Shifted apostrophe key', [
        '"Stay calm."',
        '"Type clearly."',
        '"Keep going."',
      ]),
      l('punctuation-colon', 'Colons', 'Shifted semicolon key', [
        'Step 1: relax.',
        'Goal: stay exact.',
        'Remember: slow down.',
      ]),
      l(
        'punctuation-parentheses',
        'Parentheses',
        'Shifted number-row reaches',
        ['type (slowly)', 'check (once)', 'repeat (calmly)'],
      ),
      l(
        'punctuation-mixed',
        'Mixed punctuation',
        'Complete sentence mechanics',
        [
          'Pause, reset; then type.',
          'Ready? Begin now.',
          'Accuracy first, then speed.',
        ],
      ),
    ],
  },
  {
    id: 'numbers-symbols',
    title: 'Numbers and symbols',
    description:
      'Reach for the number row while preserving home-row orientation.',
    lessons: [
      l(
        'numbers-left',
        'Numbers 1–5',
        'Left-hand number reaches',
        '1 2 3 4 5 12 23 34 45',
      ),
      l(
        'numbers-right',
        'Numbers 6–0',
        'Right-hand number reaches',
        '6 7 8 9 0 67 78 89 90',
      ),
      l(
        'numbers-mixed',
        'Mixed numbers',
        'Alternating number-row reaches',
        '16 27 38 49 50 123 789',
      ),
      l(
        'numbers-groups',
        'Number groups',
        'Longer numeric sequences',
        '12345 67890 13579 24680 1024',
      ),
      l(
        'symbols-left',
        'Left-side symbols',
        'Shift with numbers 1–5',
        '! @ # $ % !@# $%! #@$',
      ),
      l(
        'symbols-right',
        'Right-side symbols',
        'Shift with numbers 6–0',
        '^ & * ( ) ^&* () *&^',
      ),
      l(
        'symbols-brackets',
        'Brackets and braces',
        'Right-pinky reaches',
        '[] {} [key] {type} [calm] {clear}',
      ),
      l(
        'symbols-operators',
        'Operators',
        'Minus, equals and shifted forms',
        '- = _ + 1+1=2 5-3=2 a_b',
      ),
      l('numbers-text', 'Numbers in text', 'Digits inside short sentences', [
        'Type 25 keys.',
        'Rest for 30 seconds.',
        'Repeat 3 times.',
      ]),
      l(
        'symbols-code',
        'Code-like patterns',
        'Mixed symbols and letters',
        'key_1 level_2 score=95 count+1 [ready]',
      ),
      l(
        'numbers-review',
        'Numbers and symbols review',
        'Full number-row control',
        [
          'Level 1: 25 keys.',
          'Score: 95%.',
          'Repeat (3 times).',
          'Ready? 1+1=2.',
        ],
      ),
    ],
  },
];

const THAI_LEVEL_SEEDS: LevelSeed[] = [
  {
    id: 'home-row',
    title: 'Thai home row',
    description:
      'Build Kedmanee anchor positions and return each finger to the home row.',
    lessons: [
      l(
        'home-anchors',
        'ก and ด anchors',
        'Left middle and index anchors',
        'กกก ดดด กดก ดกด กกด ดดก',
      ),
      l(
        'home-middle',
        'ห and ส',
        'Ring-finger control',
        'หหห สสส หสห สหส กห ดส',
      ),
      l('home-pinky', 'ฟ and ว', 'Pinky reaches', 'ฟฟฟ ววว ฟวฟ วฟว ฟห สว'),
      l(
        'home-inner',
        'เ and tone marks',
        'Inner index reaches',
        'เก เด เกด เดก ก่า ด่า ก้า ด้า',
      ),
      l(
        'home-right-pinky',
        'ง reach',
        'Right pinky control',
        'งงง วงง สงง กาง ดาง หาง',
      ),
      l(
        'home-left-flow',
        'Left-hand flow',
        'ฟ ห ก ด เ combinations',
        'ฟหกดเ เกด หกด ฟาก เดก',
      ),
      l(
        'home-right-flow',
        'Right-hand flow',
        'Tone, า, ส, ว, ง combinations',
        'ก่า ก้า สาว วาง สาง กวาง',
      ),
      l(
        'home-alternation',
        'Hand alternation',
        'Balanced left-right motion',
        'กา ดา หา ฟา สา วา งา เก',
      ),
      l(
        'home-spacing',
        'Space rhythm',
        'Thumb timing between groups',
        'กา หา สา วาง กาง ดาว สาว',
      ),
      l(
        'home-shapes',
        'Home-row shapes',
        'Short Kedmanee patterns',
        'กาง หาง วาง สาว ดาว กาว เกา',
      ),
      l(
        'home-review',
        'Home-row review',
        'Steady home-row movement',
        'สาววางดาว กางเกงสีสาว หาดาวสว่าง',
      ),
    ],
  },
  {
    id: 'top-row',
    title: 'Thai top row',
    description:
      'Reach upward for common Thai vowels and consonants, then return home.',
    lessons: [
      l(
        'top-left',
        'ๆ ไ and ำ',
        'Left top-row reaches',
        'ๆ ไ ไก่ กำ คำ น้ำ ทำ ซ้ำ ไฟ',
      ),
      l('top-pt', 'พ and ะ', 'Left index reaches', 'พะ พา พอดี กะ จะ นะ พระ'),
      l('top-vowels', 'ั and ี', 'Right index reaches', 'กา กั กี ดี มี สี ที่ นี้'),
      l(
        'top-rn',
        'ร and น',
        'Middle and ring reaches',
        'รอ รัก นา นอน เรียน งาน',
      ),
      l('top-y', 'ย reach', 'Right pinky control', 'ยา ยาว ยืน ยาง ยินดี ราย'),
      l('top-bl', 'บ and ล', 'Outer top-row reaches', 'บา ลา บ้าน ลาน บอล ลม'),
      l(
        'top-left-flow',
        'Left top-row flow',
        'ๆ ไ ำ พ ะ combinations',
        'ไพ ไผ่ กำแพง พอดี ทำไป',
      ),
      l(
        'top-right-flow',
        'Right top-row flow',
        'ั ี ร น ย บ ล combinations',
        'เรียน ริน ยินดี บ้าน ลาน',
      ),
      l(
        'top-alternation',
        'Top-row alternation',
        'Switch hands smoothly',
        'ไป มา เรียน ทำ งาน บ้าน เรา',
      ),
      l(
        'top-words',
        'Top-row words',
        'Common words from learned keys',
        'กิน นอน เรียน เขียน ทำงาน บ้าน',
      ),
      l(
        'top-review',
        'Top-row review',
        'Home and top rows together',
        'เราเรียนภาษาไทย ทุกวันเราฝึกที่บ้าน',
      ),
    ],
  },
  {
    id: 'bottom-row',
    title: 'Thai bottom row',
    description:
      'Reach downward for frequent Thai consonants and vowels without moving the wrists.',
    lessons: [
      l(
        'bottom-zx',
        'ผ and ป',
        'Left pinky and ring reaches',
        'ผา ปลา ปู ป่า ผ้า ไป เปิด',
      ),
      l(
        'bottom-cv',
        'แ and อ',
        'Left middle and index reaches',
        'แอ แดง อา ออก อ่าน แอบ',
      ),
      l('bottom-bn', 'ิ and ื', 'Index reaches for vowels', 'กิน ดิน ยิน ยืน คืน มือ'),
      l('bottom-m', 'ท reach', 'Right index reach', 'ทา ทาง ทำ ที่ ทุก ทัน ที'),
      l('bottom-comma', 'ม reach', 'Right middle reach', 'มา มี มือ มอง มาก ตาม'),
      l('bottom-period', 'ใ reach', 'Right ring reach', 'ใน ใจ ใส ใหม่ ใหญ่ ใกล้'),
      l('bottom-slash', 'ฝ reach', 'Right pinky reach', 'ฝา ฝน ฝัน ฝาก ฝึก ฝ่าย'),
      l(
        'bottom-left-flow',
        'Left bottom-row flow',
        'ผ ป แ อ combinations',
        'ปลา แปล ผ้า ปาก ออก แอบ',
      ),
      l(
        'bottom-right-flow',
        'Right bottom-row flow',
        'ิ ื ท ม ใ ฝ combinations',
        'ทีม มือ ใหม่ ฝึก พิมพ์',
      ),
      l(
        'bottom-words',
        'Bottom-row words',
        'Mix all three rows',
        'พิมพ์ ไทย ใหม่ ฝึก มือ ใจ',
      ),
      l(
        'bottom-review',
        'Bottom-row review',
        'Full unshifted Kedmanee movement',
        'ฝึกพิมพ์ ภาษาไทย ให้มือ เคลื่อนไหว สม่ำเสมอ',
      ),
    ],
  },
  {
    id: 'vowels-tones',
    title: 'Vowels and tone marks',
    description:
      'Coordinate Thai combining marks as complete graphemes instead of isolated keystrokes.',
    lessons: [
      l('vowel-a', 'ะ and ั', 'Short vowel patterns', 'กะ จะ นะ รัก กัน วัน ฉัน'),
      l('vowel-i', 'ิ and ี', 'Short and long i vowels', 'กิน บิน ดิน ดี มี สี ปี'),
      l('vowel-ue', 'ึ and ื', 'Short and long ue vowels', 'นึก ถึง ดึง คืน ยืน มือ'),
      l('vowel-u', 'ุ and ู', 'Short and long u vowels', 'สุข ทุก จุด ดู ปู สูง'),
      l(
        'tone-low',
        '่ low tone mark',
        'Attach the mark to a base',
        'ไก่ ป่า ใหม่ อ่าน เก่ง ข่าว',
      ),
      l(
        'tone-falling',
        '้ falling tone mark',
        'Attach the mark cleanly',
        'บ้าน ข้าว น้ำ เข้า ช้า',
      ),
      l(
        'tone-high',
        '๊ high tone mark',
        'Shifted vowel-key reach',
        'โต๊ะ จ๊ะ เอ๊ะ เป๊ะ',
      ),
      l(
        'tone-rising',
        '๋ rising tone mark',
        'Shifted tone-key reach',
        'จ๋า ป๋า ตั๋ว เดี๋ยว',
      ),
      l(
        'mai-taikhu',
        '็ shortener mark',
        'Shifted mark control',
        'เด็ก เล็ก เป็น เห็น เก็บ',
      ),
      l(
        'thanthakhat',
        '์ silent mark',
        'Right index shifted reach',
        'พิมพ์ ศัพท์ จันทร์ สัตว์',
      ),
      l(
        'marks-review',
        'Vowel and tone review',
        'Mixed grapheme control',
        'เด็กเก่งพิมพ์ข้อความ ฝึกคำสั้นให้แม่น',
      ),
    ],
  },
  {
    id: 'common-patterns',
    title: 'Common Thai patterns',
    description:
      'Automate frequent consonant-vowel and syllable transitions used in everyday Thai.',
    lessons: [
      l(
        'patterns-ka',
        'ก vowel family',
        'One base with many vowels',
        'กา กิ กี กึ กื กุ กู เก แก ไก',
      ),
      l(
        'patterns-ma',
        'ม vowel family',
        'Right-hand base patterns',
        'มา มิ มี มึ มื มุ มู เม แม ไม',
      ),
      l(
        'patterns-pa',
        'ป vowel family',
        'Left ring base patterns',
        'ปา ปิ ปี ปึ ปื ปุ ปู เป แป ไป',
      ),
      l(
        'patterns-n',
        'น endings',
        'Common final consonant',
        'กิน งาน อ่าน เขียน เรียน นอน',
      ),
      l(
        'patterns-ng',
        'ง endings',
        'Right pinky endings',
        'ทาง มอง วาง แสง จริง เก่ง',
      ),
      l(
        'patterns-k',
        'ก endings',
        'Left index endings',
        'มาก เล็ก เด็ก รัก ฝึก นึก',
      ),
      l(
        'patterns-t',
        'ด and ต endings',
        'Closing syllables cleanly',
        'จด ปิด เปิด พูด คิด ชัด',
      ),
      l(
        'patterns-ai',
        'ไ ใ and vowel fronts',
        'Left and right upper reaches',
        'ไป ใน ให้ ใหม่ ใจ ไกล',
      ),
      l(
        'patterns-leading',
        'เ แ โ vowel fronts',
        'Type leading vowels first',
        'เก แก โต โดน แดง เรียน',
      ),
      l(
        'patterns-clusters',
        'Consonant clusters',
        'Controlled multi-key syllables',
        'กราบ กลาง ปลา พราว ครู',
      ),
      l(
        'patterns-review',
        'Pattern review',
        'Blend frequent Thai syllables',
        'ฝึกทุกวัน พิมพ์คำไทยให้คล่องขึ้น',
      ),
    ],
  },
  {
    id: 'words-sentences',
    title: 'Thai words and sentences',
    description:
      'Turn key control into natural Thai words, spacing, and complete sentences.',
    lessons: [
      l(
        'words-short',
        'Short words',
        'One-syllable rhythm',
        'ไป มา ดี มี กิน นอน ทำ งาน',
      ),
      l(
        'words-common',
        'Common words',
        'Everyday vocabulary',
        'วันนี้ เวลา บ้าน เรียน หนังสือ',
      ),
      l(
        'words-long',
        'Longer words',
        'Maintain rhythm through length',
        'ภาษาไทย แบบฝึกหัด ความแม่นยำ',
      ),
      l(
        'words-compound',
        'Compound words',
        'Connect familiar word parts',
        'แป้นพิมพ์ กล้ามเนื้อ ความเร็ว',
      ),
      l(
        'sentence-calm',
        'Calm rhythm',
        'Short complete sentences',
        'พิมพ์ช้าให้แม่น วางมือให้สบาย',
      ),
      l(
        'sentence-focus',
        'Focused typing',
        'Accuracy-focused sentences',
        'มองหน้าจอ กดแป้นให้ถูกต้อง',
      ),
      l(
        'sentence-hands',
        'Hand position',
        'Home-row reminders',
        'วางนิ้วบนแถวหลัก ผ่อนคลายมือ',
      ),
      l(
        'sentence-speed',
        'Controlled speed',
        'Build pace without rushing',
        'รักษาจังหวะสม่ำเสมอ อย่ารีบพิมพ์',
      ),
      l(
        'sentence-correction',
        'Corrections',
        'Recover without losing rhythm',
        'เมื่อพิมพ์ผิด ให้แก้แล้วพิมพ์ต่อ',
      ),
      l(
        'sentence-spacing',
        'Thai spacing',
        'Use spaces between clauses',
        'หายใจสบาย แล้วเริ่มพิมพ์อีกครั้ง',
      ),
      l(
        'sentence-review',
        'Sentence review',
        'Mixed sentence practice',
        'ฝึกอย่างสม่ำเสมอ แล้วความเร็วจะตามมา',
      ),
    ],
  },
  {
    id: 'shift-rare',
    title: 'Shifted Thai keys',
    description:
      'Use the opposite Shift key for tone marks, formal letters, and less frequent symbols.',
    lessons: [
      l(
        'shift-tones',
        'Shifted tone marks',
        '๊ ๋ and ็ control',
        'โต๊ะ จ๋า เด็ก เป็น ตั๋ว เก็บ',
      ),
      l(
        'shift-formal-left',
        'ฏ ฎ and ฤ',
        'Shifted left-hand letters',
        'ปฏิบัติ กฎ ฤดู กฎหมาย',
      ),
      l(
        'shift-formal-middle',
        'ฑ ธ and ฌ',
        'Shifted index letters',
        'มณฑล ธรรม ฌาน พุธ',
      ),
      l(
        'shift-formal-right',
        'ณ ญ and ฐ',
        'Shifted right-hand letters',
        'คุณ ญาติ ฐาน ปัญญา',
      ),
      l(
        'shift-sibilants',
        'ษ ศ ซ',
        'Shifted home-row letters',
        'ภาษา ศึกษา ศูนย์ ซ้าย',
      ),
      l(
        'shift-bottom',
        'ฉ ฮ and ฒ',
        'Shifted bottom-row letters',
        'ฉัน อาหาร พัฒนา วุฒิ',
      ),
      l('shift-rare', 'ฬ ฦ and ฅ', 'Rare shifted letters', 'กีฬา จุฬา ฅน ฦชา'),
      l(
        'shift-punctuation',
        'Thai punctuation',
        'ฯ and ๆ in context',
        'กรุงเทพฯ ต่างๆ เร็วๆ ช้าๆ',
      ),
      l(
        'shift-quotes',
        'Quotes and parentheses',
        'Shift coordination',
        '"ภาษาไทย" (ฝึกทุกวัน)',
      ),
      l(
        'shift-mixed',
        'Mixed Shift practice',
        'Alternate both Shift keys',
        'เด็กๆ ศึกษาภาษาไทยที่กรุงเทพฯ',
      ),
      l(
        'shift-review',
        'Shifted-key review',
        'Formal and everyday combinations',
        'ศึกษาภาษาไทย พัฒนาทักษะการพิมพ์',
      ),
    ],
  },
  {
    id: 'numbers-fluency',
    title: 'Numbers and Thai fluency',
    description:
      'Finish with Thai numerals, mixed text, punctuation, and sustained accurate typing.',
    lessons: [
      l(
        'thai-numbers-left',
        'Thai numbers ๑–๔',
        'Shifted left number row',
        '๑ ๒ ๓ ๔ ๑๒ ๒๓ ๓๔',
      ),
      l(
        'thai-numbers-right',
        'Thai numbers ๕–๙',
        'Shifted right number row',
        '๕ ๖ ๗ ๘ ๙ ๕๖ ๗๘ ๙๙',
      ),
      l(
        'thai-zero',
        'Thai zero',
        'Shifted top-left reach',
        '๐ ๑๐ ๒๐ ๓๐ ๕๐ ๑๐๐',
      ),
      l(
        'arabic-numbers',
        'Arabic numbers in Thai text',
        'Number-row switching',
        'บทที่ 1 เวลา 5 นาที คะแนน 95',
      ),
      l(
        'dates',
        'Dates and counts',
        'Numbers inside phrases',
        'วันที่ 12 เดือน 9 ฝึก 3 รอบ',
      ),
      l(
        'punctuation',
        'Comma and period',
        'Sentence punctuation',
        'พิมพ์ช้า, ตรวจคำ, แล้วพิมพ์ต่อ.',
      ),
      l(
        'mixed-terms',
        'Thai with English terms',
        'Switch scripts carefully',
        'ฝึก Thai typing วันละ 10 นาที',
      ),
      l(
        'fluency-short',
        'Short fluency',
        'Sustain an even pace',
        'มือทั้งสองข้าง ทำงานร่วมกันอย่างสมดุล',
      ),
      l(
        'fluency-medium',
        'Medium fluency',
        'Hold accuracy across a sentence',
        'ความแม่นยำ เกิดจากการวางนิ้วและจังหวะที่ดี',
      ),
      l(
        'fluency-correction',
        'Fluency with correction',
        'Resume smoothly after errors',
        'สังเกตข้อผิดพลาด แก้ไข แล้วกลับสู่จังหวะเดิม',
      ),
      l(
        'fluency-review',
        'Course review',
        'Complete Kedmanee control',
        'ฝึกพิมพ์ภาษาไทยอย่างตั้งใจ สร้างความจำของกล้ามเนื้อ',
      ),
    ],
  },
];

function buildLevel(seed: LevelSeed, language: StudyLanguage): StudyLevel {
  const prefix = language === 'thai' ? 'thai-' : '';
  const lessons: StudyLesson[] = seed.lessons.map((item, index) => ({
    id: `${prefix}${item.id}`,
    language,
    title: item.title,
    focus: item.focus,
    checkpoint: false,
    rounds: [0, 3, 7].map((offset) => buildRound(item.tokens, offset + index)),
  }));
  const checkpointTokens = seed.lessons.flatMap((item) => item.tokens);
  lessons.push({
    id: `${prefix}${seed.id}-checkpoint`,
    language,
    title: `${seed.title} checkpoint`,
    focus: 'Pass the complete level review to continue',
    checkpoint: true,
    rounds: [0, 11, 23, 37, 53].map((offset) =>
      buildRound(checkpointTokens, offset),
    ),
  });
  return { ...seed, id: `${prefix}${seed.id}`, language, lessons };
}

function flattenLevels(levels: StudyLevel[]) {
  return levels.flatMap((level, levelIndex) =>
    level.lessons.map((item, lessonIndex) => ({
      ...item,
      levelId: level.id,
      levelTitle: level.title,
      levelNumber: levelIndex + 1,
      lessonNumber: lessonIndex + 1,
    })),
  );
}

const ENGLISH_STUDY_LEVELS = ENGLISH_LEVEL_SEEDS.map((seed) =>
  buildLevel(seed, 'english'),
);
const THAI_STUDY_LEVELS = THAI_LEVEL_SEEDS.map((seed) =>
  buildLevel(seed, 'thai'),
);

export const STUDY_COURSES = {
  english: {
    language: 'english' as const,
    label: 'English',
    levels: ENGLISH_STUDY_LEVELS,
    lessons: flattenLevels(ENGLISH_STUDY_LEVELS),
  },
  thai: {
    language: 'thai' as const,
    label: 'Thai',
    levels: THAI_STUDY_LEVELS,
    lessons: flattenLevels(THAI_STUDY_LEVELS),
  },
};

export const STUDY_LEVELS = STUDY_COURSES.english.levels;
export const STUDY_LESSONS = [
  ...STUDY_COURSES.english.lessons,
  ...STUDY_COURSES.thai.lessons,
];

export type FlatStudyLesson = (typeof STUDY_LESSONS)[number];

export function getStudyLesson(lessonId: string | null | undefined) {
  return STUDY_LESSONS.find((item) => item.id === lessonId);
}

export function getStudyCourse(language: StudyLanguage) {
  return STUDY_COURSES[language];
}

export function getStudyLessonText(item: StudyLesson) {
  return item.rounds.join('');
}

export function countStudyLessonCharacters(item: StudyLesson) {
  return item.rounds.reduce(
    (total, round) => total + countStudyCharacters(round),
    0,
  );
}
