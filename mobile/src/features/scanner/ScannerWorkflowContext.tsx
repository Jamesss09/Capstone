import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { uuid } from 'expo';

export type ScannerSource = 'capture' | 'upload';

export type WorkflowPhoto = {
  uri: string;
  mimeType: string;
  fileName?: string;
};

export type WorkflowApplicant = {
  id: number;
  code: string;
};

export type WorkflowApplicantDraft = {
  applicantName: string;
  examinationDate: string;
  mobileNumber: string;
  studentType: 'NEW' | 'TRANSFEREE' | 'OLD' | 'RETURNEE';
  course: string;
};

type ScannerWorkflowValue = {
  source: ScannerSource;
  photo: WorkflowPhoto | null;
  applicant: WorkflowApplicant | null;
  applicantDraft: WorkflowApplicantDraft | null;
  submissionId: string;
  setSource: (source: ScannerSource) => void;
  setPhoto: (photo: WorkflowPhoto | null) => void;
  setApplicant: (applicant: WorkflowApplicant | null) => void;
  setApplicantDraft: (draft: WorkflowApplicantDraft | null) => void;
  clearWorkflow: () => void;
};

const ScannerWorkflowContext = createContext<ScannerWorkflowValue | null>(null);

export function ScannerWorkflowProvider({ children }: PropsWithChildren) {
  const [source, setSource] = useState<ScannerSource>('capture');
  const [photo, setPhoto] = useState<WorkflowPhoto | null>(null);
  const [applicant, setApplicant] = useState<WorkflowApplicant | null>(null);
  const [applicantDraft, setApplicantDraft] = useState<WorkflowApplicantDraft | null>(null);
  const [submissionId, setSubmissionId] = useState(() => uuid.v4());

  const clearWorkflow = useCallback(() => {
    setSource('capture');
    setPhoto(null);
    setApplicant(null);
    setApplicantDraft(null);
    setSubmissionId(uuid.v4());
  }, []);

  const value = useMemo<ScannerWorkflowValue>(
    () => ({
      source,
      photo,
      applicant,
      applicantDraft,
      submissionId,
      setSource,
      setPhoto,
      setApplicant,
      setApplicantDraft,
      clearWorkflow,
    }),
    [applicant, applicantDraft, clearWorkflow, photo, source, submissionId],
  );

  return <ScannerWorkflowContext.Provider value={value}>{children}</ScannerWorkflowContext.Provider>;
}

export function useScannerWorkflow(): ScannerWorkflowValue {
  const context = useContext(ScannerWorkflowContext);

  if (!context) {
    throw new Error('useScannerWorkflow must be used inside ScannerWorkflowProvider.');
  }

  return context;
}
