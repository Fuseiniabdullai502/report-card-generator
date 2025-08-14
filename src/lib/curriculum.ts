// src/lib/curriculum.ts

export const curriculumLevels = {
  KG: ['Numeracy', 'Literacy', 'Creative Arts', 'Our World, Our People'],
  PRIMARY: [
    'English Language',
    'Mathematics',
    'Science',
    'Our World, Our People',
    'Creative Arts',
    'Ghanaian Language',
    'Religious and Moral Education (R.M.E)',
    'Computing',
  ],
  JHS: [
    'English Language',
    'Mathematics',
    'Integrated Science',
    'Social Studies',
    'Ghanaian Language',
    'Religious and Moral Education (R.M.E)',
    'Basic Design and Technology (BDT)',
    'Computing',
    'French', // Often optional
  ],
  SHS: [
    // Core Subjects
    'English Language',
    'Core Mathematics',
    'Integrated Science',
    'Social Studies',
    // Common Electives (not exhaustive)
    'Elective Mathematics',
    'Biology',
    'Chemistry',
    'Physics',
    'Economics',
    'Geography',
    'Government',
    'History',
    'Literature-in-English',
    'Financial Accounting',
    'Business Management',
  ],
};

export const getClassLevel = (className: string): keyof typeof curriculumLevels | null => {
    if (!className) return null;
    const upperClassName = className.toUpperCase();

    if (upperClassName.startsWith('KG')) return 'KG';
    if (upperClassName.startsWith('CLASS') || upperClassName.startsWith('PRIMARY')) return 'PRIMARY';
    if (upperClassName.startsWith('JHS')) return 'JHS';
    if (upperClassName.startsWith('SHS')) return 'SHS';
    
    // Fallback for non-standard names, can be adjusted
    if (upperClassName.includes('KINDERGARTEN')) return 'KG';
    if (upperClassName.includes('JUNIOR HIGH')) return 'JHS';
    if (upperClassName.includes('SENIOR HIGH')) return 'SHS';

    return null; // Or a default level like 'PRIMARY'
};
