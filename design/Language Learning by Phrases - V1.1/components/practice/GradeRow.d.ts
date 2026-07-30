export interface GradeRowProps {
  /** Interval shown under "Good" — computed from the phrase's rep count. */
  goodInterval?: string;
  onGrade?: (grade: 'again' | 'hard' | 'good' | 'easy') => void;
}
export declare function GradeRow(props: GradeRowProps): JSX.Element;
