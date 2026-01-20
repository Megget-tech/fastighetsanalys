import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Path to the fanalys project
const FANALYS_PATH = '/Users/patrikpettersson/Documents/Dokument/fanalys/real_estate_analysis';

export interface AnalysisInput {
  // Metadata
  property_name?: string;
  coordinates?: { longitude: number; latitude: number };
  kommun_name: string;
  deso_codes: string[];
  export_date: string;

  // All metrics from aggregatedMetrics
  metrics: {
    income: any;
    population: any;
    education: any;
    migration: any;
    origin: any;
    household: any;
    housing_type: any;
    tenure_form: any;
    economic_standard?: any;
    earned_income?: any;
  };

  // Optional Booli data
  booli_data?: any;
}

export interface AnalysisSummary {
  status: 'completed' | 'error';
  recommendation: 'GO' | 'NO-GO' | 'FURTHER-ANALYSIS';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  pdf_file?: string;
  map_file?: string;
  error?: string;
}

export interface AnalysisResult {
  success: boolean;
  summary: AnalysisSummary;
  fullResults?: any;
  files: {
    json?: string;
    pdf?: string;
    map?: string;
  };
}

/**
 * Run Python script and capture output
 */
function runPythonScript(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    console.log('[Analysis] Running Python script with args:', args);

    const python = spawn('python3', args, {
      cwd: FANALYS_PATH,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress to console
      console.log('[fanalys]', data.toString().trim());
    });

    python.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
      }
    });

    python.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Run quick analysis on input data
 */
export async function runQuickAnalysis(
  inputData: AnalysisInput,
  nyproduktionFilePath?: string
): Promise<AnalysisResult> {
  // Create temp directory for this analysis
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fanalys-'));
  const inputPath = path.join(tempDir, 'input.json');
  const outputPath = path.join(tempDir, 'result.json');
  const pdfPath = path.join(tempDir, 'report.pdf');

  console.log('[Analysis] Temp directory:', tempDir);
  console.log('[Analysis] Input data:', JSON.stringify(inputData, null, 2).substring(0, 500) + '...');

  try {
    // Write input data to temp file
    await fs.writeFile(inputPath, JSON.stringify(inputData, null, 2));

    // Build command arguments
    const args = [
      'cli_quick_analysis.py',
      '--input', inputPath,
      '--output', outputPath,
      '--pdf', pdfPath
    ];

    // Add nyproduktion file if provided
    if (nyproduktionFilePath) {
      args.push('--nyproduktion', nyproduktionFilePath);
    }

    // Run Python script
    const result = await runPythonScript(args);

    // Parse the JSON output from stdout
    let summary: AnalysisSummary;
    try {
      summary = JSON.parse(result.stdout);
    } catch (e) {
      console.error('[Analysis] Failed to parse stdout as JSON:', result.stdout);
      throw new Error('Failed to parse analysis output');
    }

    // Read full results if available
    let fullResults = null;
    try {
      const resultContent = await fs.readFile(outputPath, 'utf-8');
      fullResults = JSON.parse(resultContent);
    } catch (e) {
      console.error('[Analysis] Could not read full results:', e);
    }

    return {
      success: summary.status === 'completed',
      summary,
      fullResults,
      files: {
        json: outputPath,
        pdf: summary.pdf_file,
        map: summary.map_file
      }
    };

  } catch (error: any) {
    console.error('[Analysis] Error:', error);
    // Don't clean up temp dir on error - useful for debugging
    return {
      success: false,
      summary: {
        status: 'error',
        recommendation: 'FURTHER-ANALYSIS',
        confidence: 'low',
        rationale: 'Analysen kunde inte genomföras på grund av ett tekniskt fel.',
        error: error.message
      },
      files: {}
    };
  }
}

export interface FullAnalysisSummary extends AnalysisSummary {
  qaDecision?: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
  keyRecommendations?: string[];
  executivePdf?: string;
}

export interface FullAnalysisResult {
  success: boolean;
  summary: FullAnalysisSummary;
  fullResults?: any;
  files: {
    json?: string;
    pdf?: string;
    executivePdf?: string;
    map?: string;
  };
}

/**
 * Run full analysis on input data
 * Note: This takes 5-15 minutes to complete
 */
export async function runFullAnalysis(
  inputData: AnalysisInput,
  nyproduktionFilePath?: string
): Promise<FullAnalysisResult> {
  // Create temp directory for this analysis
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fanalys-full-'));
  const inputPath = path.join(tempDir, 'input.json');
  const outputPath = path.join(tempDir, 'result.json');
  const pdfPath = path.join(tempDir, 'full_report.pdf');
  const executivePdfPath = path.join(tempDir, 'executive_report.pdf');

  console.log('[Full Analysis] Temp directory:', tempDir);
  console.log('[Full Analysis] Starting full analysis (this may take 5-15 minutes)...');

  try {
    // Write input data to temp file
    await fs.writeFile(inputPath, JSON.stringify(inputData, null, 2));

    // Build command arguments
    const args = [
      'cli_full_analysis.py',
      '--input', inputPath,
      '--output', outputPath,
      '--pdf', pdfPath,
      '--executive-pdf', executivePdfPath
    ];

    // Add nyproduktion file if provided
    if (nyproduktionFilePath) {
      args.push('--nyproduktion', nyproduktionFilePath);
    }

    // Run Python script (with longer timeout for full analysis)
    const result = await runPythonScript(args);

    // Parse the JSON output from stdout
    let summary: FullAnalysisSummary;
    try {
      summary = JSON.parse(result.stdout);
    } catch (e) {
      console.error('[Full Analysis] Failed to parse stdout as JSON:', result.stdout);
      throw new Error('Failed to parse analysis output');
    }

    // Read full results if available
    let fullResults = null;
    try {
      const resultContent = await fs.readFile(outputPath, 'utf-8');
      fullResults = JSON.parse(resultContent);
    } catch (e) {
      console.error('[Full Analysis] Could not read full results:', e);
    }

    return {
      success: summary.status === 'completed',
      summary,
      fullResults,
      files: {
        json: outputPath,
        pdf: summary.pdf_file || pdfPath,
        executivePdf: summary.executivePdf || executivePdfPath,
        map: summary.map_file
      }
    };

  } catch (error: any) {
    console.error('[Full Analysis] Error:', error);
    return {
      success: false,
      summary: {
        status: 'error',
        recommendation: 'FURTHER-ANALYSIS',
        confidence: 'low',
        rationale: 'Den fullständiga analysen kunde inte genomföras på grund av ett tekniskt fel.',
        error: error.message
      },
      files: {}
    };
  }
}

/**
 * Clean up temp files after serving to user
 */
export async function cleanupAnalysisFiles(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('[Analysis] Cleaned up temp directory:', tempDir);
  } catch (e) {
    console.error('[Analysis] Failed to clean up:', e);
  }
}
