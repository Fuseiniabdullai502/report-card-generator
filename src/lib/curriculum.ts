

// src/lib/curriculum.ts

export const curriculumLevels = {
  NURSERY: [
    'Language and Literacy (English)',
    'Mathematics (Number Work)',
    'Creative Arts',
    'Our World, Our People',
    'Physical Development and Health',
  ],
  KG: [
    'Language and Literacy (English)',
    'Mathematics',
    'Creative Arts',
    'Our World, Our People',
    'Ghanaian Language',
    'Physical Education and Health',
  ],
  PRIMARY: [
    'English Language',
    'Mathematics',
    'Science',
    'Our World, Our People',
    'Creative Arts',
    'Ghanaian Language',
    'Religious and Moral Education (R.M.E)',
    'Computing',
    'Physical Education',
    'History of Ghana',
  ],
  JHS: [
    'English Language',
    'Mathematics',
    'Integrated Science',
    'Social Studies',
    'Ghanaian Language',
    'Religious and Moral Education (R.M.E)',
    'Career Technology (B.D.T)',
    'Computing',
    'French',
    'Arabic',
  ],
  SHS_CORE: [
    'English Language',
    'Core Mathematics',
    'Integrated Science',
    'Social Studies',
  ],
  SHS_AGRIC: [
    'General Agriculture',
    'Crop Husbandry and Horticulture',
    'Animal Husbandry',
    'Chemistry',
    'Physics',
    'ICT (Elective)',
  ],
  SHS_BUSINESS: [
    'Business Management',
    'Financial Accounting',
    'Principles of Costing',
    'Economics',
    'Elective Mathematics',
    'ICT (Elective)',
    'Clerical Office Duties',
  ],
  SHS_VISUAL_ARTS: [
    'General Knowledge in Art',
    'Graphic Design',
    'Picture Making',
    'Sculpture',
    'Textiles',
    'Ceramics',
    'Leatherwork',
    'ICT (Elective)',
  ],
  SHS_HOME_ECONOMICS: [
    'Management in Living',
    'Food and Nutrition',
    'Clothing and Textiles',
    'General Knowledge in Art',
    'Biology',
    'Chemistry',
    'ICT (Elective)',
  ],
  SHS_TECHNICAL: [
    'Technical Drawing',
    'Building Construction',
    'Woodwork',
    'Metalwork',
    'Applied Electricity',
    'Electronics',
    'Auto Mechanics',
    'ICT (Elective)',
  ],
  SHS_GENERAL_ARTS: [
    'Literature-in-English',
    'French',
    'Ghanaian Language',
    'Economics',
    'Geography',
    'History',
    'Government',
    'Christian Religious Studies',
    'Islamic Religious Studies',
    'Music',
    'Elective Mathematics',
    'ICT (Elective)',
  ],
  SHS_GENERAL_SCIENCE: [
    'Elective Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Geography',
    'ICT (Elective)',
  ],
};

export type ClassLevel = keyof typeof curriculumLevels | 'SHS' | 'TERTIARY' | null;
export type ShsProgram = keyof Omit<typeof curriculumLevels, 'NURSERY' | 'KG' | 'PRIMARY' | 'JHS' | 'SHS_CORE'>;

export const shsProgramOptions: { value: ShsProgram, label: string }[] = [
    { value: 'SHS_GENERAL_SCIENCE', label: 'General Science' },
    { value: 'SHS_GENERAL_ARTS', label: 'General Arts' },
    { value: 'SHS_BUSINESS', label: 'Business' },
    { value: 'SHS_AGRIC', label: 'Agriculture' },
    { value: 'SHS_HOME_ECONOMICS', label: 'Home Economics' },
    { value: 'SHS_VISUAL_ARTS', label: 'Visual Arts' },
    { value: 'SHS_TECHNICAL', label: 'Technical' },
];

export const getClassLevel = (className: string): ClassLevel => {
    if (!className) return null;
    const upperClassName = className.toUpperCase();

    if (upperClassName.startsWith('NURSERY')) return 'NURSERY';
    if (upperClassName.startsWith('KG') || upperClassName.includes('KINDERGARTEN')) return 'KG';
    if (upperClassName.startsWith('CLASS') || upperClassName.startsWith('PRIMARY') || upperClassName.startsWith('BASIC')) return 'PRIMARY';
    if (upperClassName.startsWith('JHS') || upperClassName.includes('JUNIOR HIGH')) return 'JHS';
    if (upperClassName.startsWith('SHS') || upperClassName.includes('SENIOR HIGH')) return 'SHS';
    if (upperClassName.startsWith('LEVEL')) return 'TERTIARY';


    return null;
};

export const getSubjectsForClass = (className: string, shsProgram?: ShsProgram): string[] => {
    const level = getClassLevel(className);

    if (!level) return [];

    let subjects: string[] = [];

    if (level === 'SHS') {
        subjects = [...curriculumLevels.SHS_CORE];
        if (shsProgram && curriculumLevels[shsProgram]) {
            subjects = [...subjects, ...curriculumLevels[shsProgram]];
        }
    } else if (level in curriculumLevels) {
        subjects = curriculumLevels[level as keyof typeof curriculumLevels];
    }

    // Return a sorted list of unique subjects
    return Array.from(new Set(subjects)).sort();
}
