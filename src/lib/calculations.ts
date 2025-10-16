import type { SubjectEntry } from '@/lib/schemas';

export function calculateSubjectFinalMark(subject: SubjectEntry): number | null {
  const caMarkInput = subject.continuousAssessment;
  const examMarkInput = subject.examinationMark;

  const caVal = Number(caMarkInput);
  const examVal = Number(examMarkInput);
  
  const caIsValid = caMarkInput !== null && caMarkInput !== undefined && !Number.isNaN(caVal);
  const examIsValid = examMarkInput !== null && examMarkInput !== undefined && !Number.isNaN(examVal);

  if (!caIsValid && !examIsValid) {
    return null;
  }

  const safeCaVal = caIsValid ? caVal : 0;
  const safeExamVal = examIsValid ? examVal : 0;

  const scaledCaMark = (safeCaVal / 60) * 50;
  const scaledExamMark = (safeExamVal / 100) * 50;
  
  let finalPercentageMark = scaledCaMark + scaledExamMark;
  finalPercentageMark = Math.min(finalPercentageMark, 100);
  
  if (Number.isNaN(finalPercentageMark)) {
      return null;
  }

  return parseFloat(finalPercentageMark.toFixed(1));
}

export function calculateOverallAverage(subjects: SubjectEntry[]): number | null {
    if (!subjects || subjects.length === 0) {
        return null;
    }

    let totalScore = 0;
    let validSubjectCount = 0;
    let hasValidSubjects = false;

    subjects.forEach(subject => {
        if (subject.subjectName && subject.subjectName.trim() !== '') {
            hasValidSubjects = true;
            const finalMark = calculateSubjectFinalMark(subject);
            if (finalMark !== null) {
                totalScore += finalMark;
                validSubjectCount++;
            }
        }
    });

    if (hasValidSubjects && validSubjectCount > 0) {
        return parseFloat((totalScore / validSubjectCount).toFixed(2));
    }

    return null;
}
