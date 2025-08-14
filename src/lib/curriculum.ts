
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
  ],
  SHS_BUSINESS: [
    'Business Management',
    'Financial Accounting',
    'Principles of Costing',
    'Economics',
    'Elective Mathematics',
  ],
  SHS_VISUAL_ARTS: [
    'General Knowledge in Art',
    'Graphic Design',
    'Picture Making',
    'Sculpture',
    'Textiles',
    'Ceramics',
    'Leatherwork',
  ],
  SHS_HOME_ECONOMICS: [
    'Management in Living',
    'Food and Nutrition',
    'Clothing and Textiles',
    'General Knowledge in Art',
    'Biology',
    'Chemistry',
  ],
  SHS_TECHNICAL: [
    'Technical Drawing',
    'Building Construction',
    'Woodwork',
    'Metalwork',
    'Applied Electricity',
    'Electronics',
    'Auto Mechanics',
  ],
  SHS_GENERAL_ARTS: [
    'Literature-in-English',
    'French',
    'Ghanaian Language',
    'Economics',
    'Geography',
    'History',
    'Government',
    'Religious Studies',
    'Music',
    'Elective Mathematics',
  ],
  SHS_GENERAL_SCIENCE: [
    'Elective Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Geography',
  ],
};

export type ClassLevel = keyof typeof curriculumLevels | 'SHS' | null;

export const getClassLevel = (className: string): ClassLevel => {
    if (!className) return null;
    const upperClassName = className.toUpperCase();

    if (upperClassName.startsWith('NURSERY')) return 'NURSERY';
    if (upperClassName.startsWith('KG') || upperClassName.includes('KINDERGARTEN')) return 'KG';
    if (upperClassName.startsWith('CLASS') || upperClassName.startsWith('PRIMARY') || upperClassName.startsWith('BASIC')) return 'PRIMARY';
    if (upperClassName.startsWith('JHS') || upperClassName.includes('JUNIOR HIGH')) return 'JHS';
    if (upperClassName.startsWith('SHS') || upperClassName.includes('SENIOR HIGH')) return 'SHS';

    return null;
};

export const getSubjectsForClass = (className: string): string[] => {
    const level = getClassLevel(className);

    if (!level) return [];

    let subjects: string[] = [];

    if (level === 'SHS') {
        // For SHS, combine core with all electives for selection flexibility
        subjects = [
            ...curriculumLevels.SHS_CORE,
            ...curriculumLevels.SHS_GENERAL_SCIENCE,
            ...curriculumLevels.SHS_GENERAL_ARTS,
            ...curriculumLevels.SHS_AGRIC,
            ...curriculumLevels.SHS_BUSINESS,
            ...curriculumLevels.SHS_VISUAL_ARTS,
            ...curriculumLevels.SHS_HOME_ECONOMICS,
            ...curriculumLevels.SHS_TECHNICAL,
        ];
    } else if (level in curriculumLevels) {
        subjects = curriculumLevels[level as keyof typeof curriculumLevels];
    }

    // Return a sorted list of unique subjects
    return [...new Set(subjects)].sort();
}
