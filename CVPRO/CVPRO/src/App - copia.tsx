import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Download,
  Copy,
  Linkedin,
  Target,
  MessageSquare,
  RefreshCw,
  ArrowLeft,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type AppState = 'input' | 'loading' | 'diagnostic' | 'results' | 'error';

interface FileData {
  data: string; // base64
  mimeType: string;
  name: string;
}

interface AnalysisResult {
  matchScore: number;
  matchLevel: 'Bajo' | 'Medio' | 'Alto' | 'Excelente';
  strengths: string[];
  gaps: string[];
  presentKeywords: string[];
  missingKeywords: string[];
  summary: string;
}

interface OptimizedCV {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    portfolio: string;
  };
  professionalSummary: string;
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
    tools: string[];
  };
  experience: {
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    bullets: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
    relevant: string;
  }[];
  certifications: string[];
  coverLetter: string;
  linkedinSuggestions: string[];
  interviewTips: string[];
}

// --- Constants ---
const LANGS = ['ES', 'EN', 'PT', 'AUTO'];

// --- AI Service ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    matchScore: { type: Type.NUMBER },
    matchLevel: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    presentKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING },
  },
  required: ['matchScore', 'matchLevel', 'strengths', 'gaps', 'presentKeywords', 'missingKeywords', 'summary'],
};

const CV_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    personalInfo: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        location: { type: Type.STRING },
        linkedin: { type: Type.STRING },
        portfolio: { type: Type.STRING },
      },
      required: ['name', 'email', 'phone', 'location'],
    },
    professionalSummary: { type: Type.STRING },
    skills: {
      type: Type.OBJECT,
      properties: {
        technical: { type: Type.ARRAY, items: { type: Type.STRING } },
        soft: { type: Type.ARRAY, items: { type: Type.STRING } },
        languages: { type: Type.ARRAY, items: { type: Type.STRING } },
        tools: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['technical', 'soft', 'languages'],
    },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          company: { type: Type.STRING },
          location: { type: Type.STRING },
          startDate: { type: Type.STRING },
          endDate: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['title', 'company', 'startDate', 'endDate', 'bullets'],
      },
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          degree: { type: Type.STRING },
          institution: { type: Type.STRING },
          year: { type: Type.STRING },
          relevant: { type: Type.STRING },
        },
        required: ['degree', 'institution', 'year'],
      },
    },
    certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
    coverLetter: { type: Type.STRING },
    linkedinSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    interviewTips: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['personalInfo', 'professionalSummary', 'skills', 'experience', 'education', 'coverLetter', 'linkedinSuggestions', 'interviewTips'],
};

// --- Components ---

const Dropzone = ({
  label,
  icon: Icon,
  onFileSelect,
  onTextChange,
  value,
  placeholder,
  accept = ".pdf,.docx,.txt"
}: {
  label: string;
  icon: any;
  onFileSelect: (file: File) => void;
  onTextChange: (text: string) => void;
  value: string;
  placeholder: string;
  accept?: string;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-display text-gold flex items-center gap-2">
        <Icon className="w-5 h-5" />
        {label}
      </h3>
      <div
        className={cn(
          "relative group transition-all duration-300",
          isDragging ? "scale-[1.02]" : "scale-100"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={cn(
          "glass-card p-8 border-dashed border-2 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-gold/50 transition-colors",
          isDragging ? "border-gold bg-gold/5" : "border-white/10"
        )}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className={cn("w-10 h-10 transition-colors", isDragging ? "text-gold" : "text-white/40")} />
          <div className="text-center">
            <p className="text-sm font-medium">Haz clic para subir o arrastra y suelta</p>
            <p className="text-xs text-white/40 mt-1">{accept.replace(/\./g, '').toUpperCase()}</p>
          </div>
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            accept={accept}
            onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
          />
        </div>
      </div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-40 glass-card p-4 text-sm focus:outline-none focus:border-gold/50 transition-colors resize-none"
        />
        <div className="absolute bottom-3 right-3 text-[10px] text-white/20 uppercase tracking-widest">
          Entrada de Texto Plano
        </div>
      </div>
    </div>
  );
};

const LoadingState = ({ step }: { step: number }) => {
  const steps = [
    "📄 Reading your CV...",
    "🔍 Analyzing job requirements...",
    "⚡ Calculating ATS compatibility...",
    "✨ Crafting your optimized CV..."
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold animate-pulse" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xl font-display text-gold italic"
          >
            {steps[step]}
          </motion.p>
        </AnimatePresence>
        <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gold"
            initial={{ width: "0%" }}
            animate={{ width: `${(step + 1) * 25}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [state, setState] = useState<AppState>('input');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [cvText, setCvText] = useState('');
  const [jobText, setJobText] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cvFile, setCvFile] = useState<FileData | null>(null);
  const [jobFile, setJobFile] = useState<FileData | null>(null);
  const [language, setLanguage] = useState<'ES' | 'EN' | 'PT' | 'AUTO'>('AUTO');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [optimizedCV, setOptimizedCV] = useState<OptimizedCV | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = async (file: File, type: 'cv' | 'job') => {
    try {
      const base64 = await fileToBase64(file);
      const fileData = {
        data: base64,
        mimeType: file.type || (file.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream'),
        name: file.name
      };
      if (type === 'cv') setCvFile(fileData);
      else setJobFile(fileData);
    } catch (error) {
      console.error("File reading error:", error);
    }
  };

  const runAnalysis = async () => {
    if ((!cvText && !cvFile) || (!jobText && !jobFile)) return;

    setState('loading');
    setLoadingStep(1);

    try {
      const cvPart = cvFile
        ? { inlineData: { data: cvFile.data, mimeType: cvFile.mimeType } }
        : { text: cvText };

      const jobPart = jobFile
        ? { inlineData: { data: jobFile.data, mimeType: jobFile.mimeType } }
        : { text: jobText };

      const analysisResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              { text: "Analiza este CV y esta descripción de puesto. Devuelve un JSON con exactamente esta estructura:\n{\n  'matchScore': número del 0 al 100,\n  'matchLevel': 'Bajo' | 'Medio' | 'Alto' | 'Excelente',\n  'strengths': ['fortaleza 1', 'fortaleza 2', ...],  // máx 5\n  'gaps': ['gap 1', 'gap 2', ...],  // skills del puesto ausentes en el CV\n  'presentKeywords': ['kw1', 'kw2', ...],  // keywords ATS ya presentes\n  'missingKeywords': ['kw1', 'kw2', ...],  // keywords ATS del puesto que faltan\n  'summary': 'análisis en 2-3 oraciones'\n}" },
              { text: "CV DEL USUARIO:" },
              cvPart,
              { text: "DESCRIPCIÓN DEL PUESTO:" },
              jobPart
            ]
          }
        ],
        config: {
          systemInstruction: "Eres un Senior HR Recruiter experto. Analizas el match entre CV y vacante. Respondes ÚNICAMENTE en JSON válido.",
          responseMimeType: "application/json",
          responseSchema: ANALYSIS_SCHEMA as any,
        }
      });

      const text = analysisResponse.text;
      if (!text) throw new Error("Empty analysis response");

      const analysisData = JSON.parse(text) as AnalysisResult;
      if (!analysisData.matchScore && analysisData.matchScore !== 0) throw new Error("Invalid analysis data");

      setAnalysis(analysisData);
      setState('diagnostic');
    } catch (error: any) {
      console.error("Analysis error:", error);
      setErrorMessage(error.message || "Error al analizar los documentos. Por favor intenta de nuevo.");
      setState('error');
    }
  };

  const runOptimization = async () => {
    if ((!cvText && !cvFile) || (!jobText && !jobFile)) return;

    setState('loading');
    setLoadingStep(3);

    try {
      const cvPart = cvFile ? { inlineData: { data: cvFile.data, mimeType: cvFile.mimeType } } : { text: cvText };
      const jobPart = jobFile ? { inlineData: { data: jobFile.data, mimeType: jobFile.mimeType } } : { text: jobText };

      const cvResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Optimiza este CV para el puesto ${companyName ? `en ${companyName}` : ''} buscando un 100% de match.\n\nREGLAS CRÍTICAS DE RECLUTADOR SENIOR:\n1. NO inventes experiencias.\n2. ORDEN CRONOLÓGICO INVERSO.\n3. FORMATO DE FECHAS: Usa siempre 'Mes Año' (ej: 'Enero 2025') para consistencia ATS.\n4. ADAPTACIÓN ESPECÍFICA POR EMPRESA: Analiza el nombre de la empresa (${companyName || 'la empresa'}) y su industria. Adapta el tono, la terminología y los logros para que resuenen con su cultura específica. Si es Retail/GDN, prioriza e-commerce y canales digitales. Si es Tech, prioriza agilidad y stack técnico. Si es Finanzas, prioriza precisión y métricas de negocio.\n5. Keywords ATS naturales.\n6. Verbos de acción y métricas.\n7. CONCISIÓN EXTREMA: El contenido debe caber en UNA SOLA PÁGINA.\n8. IDIOMAS: Es OBLIGATORIO incluir la sección de idiomas con sus niveles específicos (ej: 'Inglés - B2 Intermedio-Avanzado').\n9. EDUCACIÓN: Resalta explícitamente el porcentaje de avance de la carrera (ej: '+25% de avance') para cumplir requisitos de pasantías.\n10. CARTA DE PRESENTACIÓN: Genera una carta de presentación persuasiva y personalizada para este puesto.\n\nDevuelve JSON.` },
              { text: "CV ORIGINAL:" },
              cvPart,
              { text: "DESCRIPCIÓN DEL PUESTO:" },
              jobPart,
              { text: `IDIOMA DE SALIDA: ${language}` }
            ]
          }
        ],
        config: {
          systemInstruction: "Eres un Senior HR Recruiter experto. Optimizas CVs para 100% match ATS. Respondes SOLO JSON.",
          responseMimeType: "application/json",
          responseSchema: CV_SCHEMA as any,
        }
      });

      const text = cvResponse.text;
      if (!text) throw new Error("Empty optimization response");

      const cvData = JSON.parse(text) as OptimizedCV;
      if (!cvData.personalInfo || !cvData.experience) throw new Error("Invalid CV data structure");

      setOptimizedCV(cvData);
      setState('results');
    } catch (error: any) {
      console.error("Optimization error:", error);
      setErrorMessage(error.message || "Error al generar el CV. Por favor intenta de nuevo.");
      setState('error');
    }
  };

  const runInstantOptimization = async () => {
    if ((!cvText && !cvFile) || (!jobText && !jobFile)) return;

    setState('loading');
    setLoadingStep(1);

    try {
      const cvPart = cvFile ? { inlineData: { data: cvFile.data, mimeType: cvFile.mimeType } } : { text: cvText };
      const jobPart = jobFile ? { inlineData: { data: jobFile.data, mimeType: jobFile.mimeType } } : { text: jobText };

      // Step 1: Analysis (Flash for speed)
      const analysisResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: 'user', parts: [{ text: "Analiza matchScore, matchLevel, strengths, gaps, presentKeywords, missingKeywords, summary. JSON format." }, cvPart, jobPart] }],
        config: {
          systemInstruction: "Analiza el match entre CV y puesto. Responde solo JSON.",
          responseMimeType: "application/json",
          responseSchema: ANALYSIS_SCHEMA as any
        }
      });

      const analysisText = analysisResponse.text;
      if (!analysisText) throw new Error("Analysis failed");
      const analysisData = JSON.parse(analysisText);
      setAnalysis(analysisData);

      // Step 2: Optimization (Pro for quality)
      setLoadingStep(3);
      const cvResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Optimiza este CV para el puesto ${companyName ? `en ${companyName}` : ''} buscando un 100% de match.\n\nREGLAS CRÍTICAS DE RECLUTADOR SENIOR:\n1. NO inventes experiencias.\n2. ORDEN CRONOLÓGICO INVERSO.\n3. FORMATO DE FECHAS: Usa siempre 'Mes Año' (ej: 'Enero 2025') para consistencia ATS.\n4. ADAPTACIÓN ESPECÍFICA POR EMPRESA: Analiza el nombre de la empresa (${companyName || 'la empresa'}) y su industria. Adapta el tono, la terminología y los logros para que resuenen con su cultura específica. Si es Retail/GDN, prioriza e-commerce y canales digitales. Si es Tech, prioriza agilidad y stack técnico. Si es Finanzas, prioriza precisión y métricas de negocio.\n5. Keywords ATS naturales.\n6. Verbos de acción y métricas.\n7. CONCISIÓN EXTREMA: El contenido debe caber en UNA SOLA PÁGINA.\n8. IDIOMAS: Es OBLIGATORIO incluir la sección de idiomas con sus niveles específicos (ej: 'Inglés - B2 Intermedio-Avanzado').\n9. EDUCACIÓN: Resalta explícitamente el porcentaje de avance de la carrera (ej: '+25% de avance') para cumplir requisitos de pasantías.\n10. CARTA DE PRESENTACIÓN: Genera una carta de presentación persuasiva y personalizada para este puesto.\n\nDevuelve JSON.` },
              { text: "CV ORIGINAL:" },
              cvPart,
              { text: "DESCRIPCIÓN DEL PUESTO:" },
              jobPart,
              { text: `IDIOMA DE SALIDA: ${language}` }
            ]
          }
        ],
        config: {
          systemInstruction: "Eres un Senior HR Recruiter experto. Optimizas CVs para 100% match ATS. Respondes SOLO JSON.",
          responseMimeType: "application/json",
          responseSchema: CV_SCHEMA as any,
        }
      });

      const cvTextResponse = cvResponse.text;
      if (!cvTextResponse) throw new Error("Optimization failed");
      const cvData = JSON.parse(cvTextResponse);
      setOptimizedCV(cvData);

      setState('results');
    } catch (error: any) {
      console.error("Instant optimization error:", error);
      setErrorMessage(error.message || "Error en la optimización instantánea. Por favor intenta de nuevo.");
      setState('error');
    }
  };

  const downloadPDF = () => {
    if (!optimizedCV) return;
    const doc = new jsPDF();
    const margin = 15;
    let y = margin;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);

    const addText = (text: string, size = 9, font = 'helvetica', style = 'normal', align: 'left' | 'center' | 'justify' = 'left') => {
      doc.setFont(font, style);
      doc.setFontSize(size);

      if (align === 'center') {
        doc.text(text || '', pageWidth / 2, y, { align: 'center' });
        y += (size * 0.35) + 1.2;
      } else {
        const lines = doc.splitTextToSize(text || '', contentWidth);
        lines.forEach((line: string) => {
          // jsPDF doesn't natively justify text in the 'text' method, but we can try to fit it
          doc.text(line, margin, y, { align: 'left', maxWidth: contentWidth });
          y += (size * 0.35) + 1.0;
        });
      }
    };

    const addSectionHeader = (title: string) => {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(40, 40, 40);
      doc.text(title, margin, y);
      y += 1.5;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4.5;
      doc.setTextColor(0, 0, 0);
    };

    // Header - Centered and Compact
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(optimizedCV.personalInfo.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const contactInfo = [
      optimizedCV.personalInfo.email,
      optimizedCV.personalInfo.phone,
      optimizedCV.personalInfo.location,
      optimizedCV.personalInfo.linkedin
    ].filter(Boolean).join('  |  ');
    doc.text(contactInfo, pageWidth / 2, y, { align: 'center' });
    y += 6;

    // Summary
    addSectionHeader('RESUMEN PROFESIONAL');
    addText(optimizedCV.professionalSummary, 9, 'helvetica', 'normal', 'justify');

    // Education
    addSectionHeader('EDUCACIÓN');
    optimizedCV.education.forEach(edu => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(edu.degree, margin, y);
      doc.setFontSize(8.5);
      doc.text(edu.year, pageWidth - margin, y, { align: 'right' });
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(edu.institution, margin, y);
      if (edu.relevant) {
        y += 3.5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Relevante: ${edu.relevant}`, margin, y);
      }
      y += 5;
    });

    // Experience
    addSectionHeader('EXPERIENCIA PROFESIONAL');
    optimizedCV.experience.forEach(exp => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(exp.title, margin, y);
      doc.setFontSize(8.5);
      doc.text(`${exp.startDate} - ${exp.endDate}`, pageWidth - margin, y, { align: 'right' });
      y += 4;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`${exp.company} | ${exp.location}`, margin, y);
      y += 4;
      doc.setTextColor(0, 0, 0);

      exp.bullets.forEach(bullet => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const bulletText = `• ${bullet}`;
        const lines = doc.splitTextToSize(bulletText, contentWidth - 5);
        lines.forEach((line: string, i: number) => {
          doc.text(line, margin + (i === 0 ? 0 : 3), y);
          y += 4.0;
        });
      });
      y += 2;
    });

    // Skills & Languages
    addSectionHeader('HABILIDADES E IDIOMAS');
    const skillsText = [
      `Técnicas: ${optimizedCV.skills.technical.join(', ')}`,
      `Habilidades Blandas: ${optimizedCV.skills.soft.join(', ')}`,
      optimizedCV.skills.languages.length ? `Idiomas: ${optimizedCV.skills.languages.join(', ')}` : ''
    ].filter(Boolean).join('\n');
    addText(skillsText, 9);

    const fileName = `CV_${optimizedCV.personalInfo.name.replace(/\s+/g, '_')}_${companyName ? companyName.replace(/\s+/g, '_') : 'Tailored'}_ATS.pdf`;
    doc.save(fileName);
  };

  const downloadCoverLetterPDF = () => {
    if (!optimizedCV) return;
    const doc = new jsPDF();
    const margin = 25;
    let y = 30;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);

    // Header - Professional and Elegant
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(optimizedCV.personalInfo.name.toUpperCase(), margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const contactInfo = [
      optimizedCV.personalInfo.email,
      optimizedCV.personalInfo.phone,
      optimizedCV.personalInfo.location
    ].filter(Boolean).join('  |  ');
    doc.text(contactInfo, margin, y);

    if (optimizedCV.personalInfo.linkedin) {
      y += 4;
      doc.text(optimizedCV.personalInfo.linkedin, margin, y);
    }

    y += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    // Date
    doc.setTextColor(0, 0, 0);
    const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(date, margin, y);
    y += 15;

    // Content
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(optimizedCV.coverLetter, contentWidth);
    lines.forEach((line: string) => {
      if (y > 270) {
        doc.addPage();
        y = 25;
      }
      doc.text(line, margin, y, { align: 'justify', maxWidth: contentWidth });
      y += 6;
    });

    const fileName = `Carta_Presentacion_${optimizedCV.personalInfo.name.replace(/\s+/g, '_')}_${companyName ? companyName.replace(/\s+/g, '_') : 'Empresa'}.pdf`;
    doc.save(fileName);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  return (
    <div className="min-h-screen bg-dark-bg selection:bg-gold/30 selection:text-gold">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-gold/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-gold/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex flex-col items-center mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-4"
          >
            <div className="w-12 h-12 gold-gradient rounded-xl flex items-center justify-center shadow-lg gold-glow">
              <Target className="text-dark-bg w-7 h-7" />
            </div>
            <h1 className="text-4xl font-display font-bold tracking-tight">
              CVForge <span className="text-gold">Pro</span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white/40 uppercase tracking-[0.3em] text-xs font-medium"
          >
            Convierte lo genérico en extraordinario
          </motion.p>
        </header>

        <main>
          {state === 'input' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <Dropzone
                    label="Tu CV"
                    icon={FileText}
                    onFileSelect={(f) => handleFileSelect(f, 'cv')}
                    onTextChange={setCvText}
                    value={cvText}
                    placeholder="Pega el contenido de tu CV actual aquí..."
                  />
                  {cvFile && (
                    <div className="flex items-center gap-2 text-xs text-gold bg-gold/5 p-2 rounded-lg border border-gold/20">
                      <CheckCircle2 className="w-4 h-4" />
                      Archivo cargado: {cvFile.name}
                      <button onClick={() => setCvFile(null)} className="ml-auto text-white/40 hover:text-white">Eliminar</button>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-display text-gold flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Detalles del Puesto
                    </h3>
                  </div>
                  <div className="glass-card p-4 space-y-4">
                    <input
                      type="text"
                      placeholder="Nombre de la Empresa (Opcional - para el PDF)"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50 transition-colors"
                    />
                    <Dropzone
                      label="Descripción del Puesto"
                      icon={ImageIcon}
                      onFileSelect={(f) => handleFileSelect(f, 'job')}
                      onTextChange={setJobText}
                      value={jobText}
                      placeholder="Pega la descripción del puesto o requisitos aquí..."
                      accept=".jpg,.jpeg,.png,.txt,.pdf"
                    />
                  </div>
                  {jobFile && (
                    <div className="flex items-center gap-2 text-xs text-gold bg-gold/5 p-2 rounded-lg border border-gold/20">
                      <CheckCircle2 className="w-4 h-4" />
                      Archivo del Puesto: {jobFile.name}
                      <button onClick={() => setJobFile(null)} className="ml-auto text-white/40 hover:text-white">Eliminar</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-4">
                  <span className="text-[10px] uppercase tracking-widest text-white/30">Idioma de Salida</span>
                  <div className="flex p-1 bg-white/5 rounded-full border border-white/10">
                    {LANGS.map((l) => (
                      <button
                        key={l}
                        onClick={() => setLanguage(l as any)}
                        className={cn(
                          "px-6 py-2 rounded-full text-xs font-medium transition-all",
                          language === l ? "bg-gold text-dark-bg shadow-lg" : "text-white/40 hover:text-white"
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
                  <button
                    onClick={runAnalysis}
                    disabled={(!cvText && !cvFile) || (!jobText && !jobFile)}
                    className="flex-1 px-8 py-5 bg-white/5 border border-white/10 text-white font-bold rounded-2xl transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50"
                  >
                    <span className="flex items-center justify-center gap-2 text-sm tracking-tight">
                      Análisis Profundo <Target className="w-4 h-4" />
                    </span>
                  </button>
                  <button
                    onClick={runInstantOptimization}
                    disabled={(!cvText && !cvFile) || (!jobText && !jobFile)}
                    className="flex-[2] group relative px-12 py-5 bg-gold text-dark-bg font-bold rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-xl gold-glow"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative flex items-center justify-center gap-2 text-lg tracking-tight">
                      Optimización Instantánea <ChevronRight className="w-5 h-5" />
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {state === 'loading' && (
            <LoadingState step={loadingStep} />
          )}

          {state === 'diagnostic' && analysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center mb-12">
                <h2 className="text-3xl font-display italic text-gold mb-2">Análisis de Diagnóstico</h2>
                <p className="text-white/40">Revisa tu compatibilidad ATS actual antes de generar la versión optimizada.</p>
              </div>

              <div className="glass-card p-12 border-gold/20 bg-gold/5">
                <div className="flex flex-col md:flex-row items-center gap-16">
                  <div className="relative flex-shrink-0">
                    <svg className="w-56 h-56 transform -rotate-90">
                      <circle
                        cx="112"
                        cy="112"
                        r="100"
                        stroke="currentColor"
                        strokeWidth="14"
                        fill="transparent"
                        className="text-white/5"
                      />
                      <motion.circle
                        cx="112"
                        cy="112"
                        r="100"
                        stroke="currentColor"
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={628.3}
                        initial={{ strokeDashoffset: 628.3 }}
                        animate={{ strokeDashoffset: 628.3 - (628.3 * analysis.matchScore) / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={cn(
                          "transition-colors",
                          analysis.matchScore > 70 ? "text-emerald-500" : analysis.matchScore > 40 ? "text-gold" : "text-rose-500"
                        )}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-6xl font-display font-bold">{analysis.matchScore}%</span>
                      <span className="text-[10px] uppercase tracking-widest text-white/40">Match ATS</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-8">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          analysis.matchScore > 70 ? "bg-emerald-500/10 text-emerald-500" : analysis.matchScore > 40 ? "bg-gold/10 text-gold" : "bg-rose-500/10 text-rose-500"
                        )}>
                          Nivel: {analysis.matchLevel}
                        </span>
                      </div>
                      <p className="text-xl font-display italic leading-relaxed text-white/80">{analysis.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Tus Fortalezas
                        </h4>
                        <ul className="space-y-3">
                          {analysis.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-white/60 leading-relaxed pl-4 border-l border-emerald-500/20">{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[10px] uppercase tracking-widest text-rose-500 font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" /> Análisis de Brechas
                        </h4>
                        <ul className="space-y-3">
                          {analysis.gaps.map((g, i) => (
                            <li key={i} className="text-sm text-white/60 leading-relaxed pl-4 border-l border-rose-500/20">{g}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-card p-8 space-y-6">
                  <h3 className="text-xs uppercase tracking-[0.3em] text-emerald-500 font-bold">Palabras Clave Presentes</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.presentKeywords.map((k, i) => (
                      <span key={i} className="px-3 py-1 bg-emerald-500/5 text-emerald-500/80 rounded-md text-[10px] border border-emerald-500/10">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="glass-card p-8 space-y-6">
                  <h3 className="text-xs uppercase tracking-[0.3em] text-rose-500 font-bold">Palabras Clave Faltantes</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.missingKeywords.map((k, i) => (
                      <span key={i} className="px-3 py-1 bg-rose-500/5 text-rose-500/80 rounded-md text-[10px] border border-rose-500/10">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-6 pt-12">
                <button
                  onClick={runOptimization}
                  className="group relative px-16 py-6 bg-gold text-dark-bg font-bold rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl gold-glow"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative flex items-center gap-3 text-xl tracking-tight">
                    Generar CV Optimizado <ChevronRight className="w-6 h-6" />
                  </span>
                </button>
                <button
                  onClick={() => setState('input')}
                  className="text-white/30 hover:text-white transition-colors uppercase tracking-widest text-[10px] font-bold"
                >
                  ← Volver al Inicio
                </button>
              </div>
            </motion.div>
          )}

          {state === 'results' && analysis && optimizedCV && optimizedCV.personalInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Diagnostic Section */}
              <div className="glass-card p-8 border-gold/20 bg-gold/5">
                <div className="flex flex-col md:flex-row items-center gap-12">
                  <div className="relative flex-shrink-0">
                    <svg className="w-48 h-48 transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-white/5"
                      />
                      <motion.circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={552.92}
                        initial={{ strokeDashoffset: 552.92 }}
                        animate={{ strokeDashoffset: 552.92 - (552.92 * (analysis.matchScore || 0)) / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={cn(
                          "transition-colors",
                          (analysis.matchScore || 0) > 70 ? "text-emerald-500" : (analysis.matchScore || 0) > 40 ? "text-gold" : "text-rose-500"
                        )}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-display font-bold">{analysis.matchScore || 0}%</span>
                      <span className="text-[10px] uppercase tracking-widest text-white/40">ATS Match</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div>
                      <h2 className="text-2xl font-display italic mb-2">Resumen del Diagnóstico</h2>
                      <p className="text-white/60 leading-relaxed">{analysis.summary || 'Análisis completado.'}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Fortalezas</h4>
                        <ul className="space-y-2">
                          {(analysis.strengths || []).map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-widest text-rose-500 font-bold">Brechas</h4>
                        <ul className="space-y-2">
                          {(analysis.gaps || []).map((g, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex flex-wrap gap-2 border-b border-white/10">
                {[
                  { label: "CV Optimizado", icon: FileText },
                  { label: "Carta de Presentación", icon: MessageSquare },
                  { label: "Palabras Clave ATS", icon: Target },
                  { label: "Consejos LinkedIn", icon: Linkedin },
                  { label: "Preparación Entrevista", icon: CheckCircle2 }
                ].map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-4 text-xs font-medium transition-all border-b-2",
                      activeTab === i
                        ? "border-gold text-gold bg-gold/5"
                        : "border-transparent text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={downloadPDF}
                        className="flex items-center gap-2 px-6 py-3 bg-gold text-dark-bg font-bold rounded-xl hover:scale-105 transition-transform"
                      >
                        <Download className="w-4 h-4" /> Descargar PDF
                      </button>
                    </div>
                    <div className="glass-card p-12 bg-white/[0.02] shadow-2xl">
                      <div className="max-w-[800px] mx-auto space-y-10">
                        {/* CV Header */}
                        <div className="text-center space-y-4">
                          <h2 className="text-4xl font-display font-bold tracking-tight">{optimizedCV.personalInfo.name}</h2>
                          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/50">
                            <span>{optimizedCV.personalInfo.email}</span>
                            <span>{optimizedCV.personalInfo.phone}</span>
                            <span>{optimizedCV.personalInfo.location}</span>
                            {optimizedCV.personalInfo.linkedin && (
                              <a href={optimizedCV.personalInfo.linkedin} className="text-gold hover:underline flex items-center gap-1">
                                LinkedIn <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* CV Summary */}
                        <section className="space-y-4">
                          <h3 className="text-xs uppercase tracking-[0.3em] text-gold font-bold border-b border-gold/20 pb-2">Resumen Profesional</h3>
                          <p className="text-lg font-display italic leading-relaxed text-white/80">{optimizedCV.professionalSummary}</p>
                        </section>

                        {/* CV Education (Moved up for better visibility in junior/student roles) */}
                        <section className="space-y-6">
                          <h3 className="text-xs uppercase tracking-[0.3em] text-gold font-bold border-b border-gold/20 pb-2">Educación</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            {optimizedCV.education.map((edu, i) => (
                              <div key={i} className="space-y-1">
                                <h4 className="font-display font-bold">{edu.degree}</h4>
                                <p className="text-sm text-white/60">{edu.institution}</p>
                                <p className="text-xs text-white/40">{edu.year}</p>
                                {edu.relevant && <p className="text-[10px] italic text-gold/60 mt-2">{edu.relevant}</p>}
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* CV Skills */}
                        <section className="space-y-4">
                          <h3 className="text-xs uppercase tracking-[0.3em] text-gold font-bold border-b border-gold/20 pb-2">Habilidades</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-3">
                              <h4 className="text-[10px] uppercase tracking-widest text-white/40">Técnicas</h4>
                              <div className="flex flex-wrap gap-2">
                                {optimizedCV.skills.technical.map((s, i) => (
                                  <span key={i} className="px-3 py-1 bg-white/5 rounded-md text-xs border border-white/10">{s}</span>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-3">
                              <h4 className="text-[10px] uppercase tracking-widest text-white/40">Habilidades Blandas</h4>
                              <div className="flex flex-wrap gap-2">
                                {optimizedCV.skills.soft.map((s, i) => (
                                  <span key={i} className="px-3 py-1 bg-white/5 rounded-md text-xs border border-white/10">{s}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </section>

                        {/* CV Experience */}
                        <section className="space-y-6">
                          <h3 className="text-xs uppercase tracking-[0.3em] text-gold font-bold border-b border-gold/20 pb-2">Experiencia Profesional</h3>
                          <div className="space-y-8">
                            {optimizedCV.experience.map((exp, i) => (
                              <div key={i} className="space-y-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="text-xl font-display font-bold">{exp.title}</h4>
                                    <p className="text-gold text-sm">{exp.company}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-medium">{exp.startDate} — {exp.endDate}</p>
                                    <p className="text-[10px] text-white/40 uppercase tracking-widest">{exp.location}</p>
                                  </div>
                                </div>
                                <ul className="space-y-2">
                                  {exp.bullets.map((b, j) => (
                                    <li key={j} className="flex items-start gap-3 text-sm text-white/70 leading-relaxed">
                                      <span className="text-gold mt-1.5 w-1 h-1 rounded-full bg-gold flex-shrink-0" />
                                      {b}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => copyToClipboard(optimizedCV.coverLetter)}
                        className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold"
                      >
                        <Copy className="w-4 h-4" /> Copiar Texto
                      </button>
                      <button
                        onClick={downloadCoverLetterPDF}
                        className="flex items-center gap-2 px-6 py-3 bg-gold text-dark-bg font-bold rounded-xl hover:scale-105 transition-transform text-xs"
                      >
                        <Download className="w-4 h-4" /> Descargar PDF
                      </button>
                    </div>
                    <div className="glass-card p-12 bg-white/[0.02] font-display text-lg leading-relaxed text-white/80 whitespace-pre-wrap">
                      {optimizedCV.coverLetter}
                    </div>
                  </motion.div>
                )}

                {activeTab === 2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="glass-card p-8 space-y-6">
                      <h3 className="text-xs uppercase tracking-[0.3em] text-emerald-500 font-bold">Presentes en tu CV</h3>
                      <div className="flex flex-wrap gap-3">
                        {analysis.presentKeywords.map((k, i) => (
                          <span key={i} className="px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-medium border border-emerald-500/20">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="glass-card p-8 space-y-6">
                      <h3 className="text-xs uppercase tracking-[0.3em] text-rose-500 font-bold">Palabras Clave Faltantes</h3>
                      <div className="flex flex-wrap gap-3">
                        {analysis.missingKeywords.map((k, i) => (
                          <span key={i} className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-full text-xs font-medium border border-rose-500/20">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 3 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {optimizedCV.linkedinSuggestions.map((s, i) => (
                      <div key={i} className="glass-card p-8 space-y-4">
                        <div className="flex items-center gap-3 text-gold">
                          <Linkedin className="w-5 h-5" />
                          <h4 className="text-xs uppercase tracking-widest font-bold">Sugerencia {i + 1}</h4>
                        </div>
                        <p className="text-white/70 leading-relaxed">{s}</p>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeTab === 4 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {optimizedCV.interviewTips.map((tip, i) => (
                      <div key={i} className="glass-card p-6 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0 text-gold font-bold text-sm">
                          {i + 1}
                        </div>
                        <p className="text-white/70 leading-relaxed pt-1">{tip}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>

              <div className="flex justify-center pt-12">
                <button
                  onClick={() => setState('input')}
                  className="flex items-center gap-2 text-white/40 hover:text-white transition-colors uppercase tracking-widest text-[10px] font-bold"
                >
                  <ArrowLeft className="w-4 h-4" /> Optimizar otro CV
                </button>
              </div>
            </motion.div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6 text-center">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-display italic">Algo salió mal</h2>
                <p className="text-white/40 max-w-md">
                  {errorMessage || "Encontramos un error al procesar tu solicitud. Por favor, intenta de nuevo o revisa tus datos de entrada."}
                </p>
              </div>
              <button
                onClick={() => setState('input')}
                className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm font-bold"
              >
                Reintentar
              </button>
            </div>
          )}
        </main>

        <footer className="mt-32 pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/10">
            © 2024 CVForge Pro • Optimización con IA de Grado Profesional
          </p>
        </footer>
      </div>
    </div>
  );
}
