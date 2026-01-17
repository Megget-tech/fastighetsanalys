/**
 * Node.js integration example for Quick Analysis
 *
 * This shows how to call the Python CLI from your Express app.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Path to the fanalys project
const FANALYS_PATH = '/path/to/fanalys/real_estate_analysis';  // Update this!

/**
 * Run quick analysis on input data
 *
 * @param {Object} inputData - JSON data from data collection
 * @param {string} nyproduktionFile - Optional path to Excel file with competing projects
 * @returns {Promise<Object>} Analysis result
 */
async function runQuickAnalysis(inputData, nyproduktionFile = null) {
    // Create temp directory for this analysis
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fanalys-'));
    const inputPath = path.join(tempDir, 'input.json');
    const outputPath = path.join(tempDir, 'result.json');
    const pdfPath = path.join(tempDir, 'report.pdf');

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
        if (nyproduktionFile) {
            args.push('--nyproduktion', nyproduktionFile);
        }

        // Run Python script
        const result = await runPythonScript(args);

        // Parse the JSON output from stdout
        const summary = JSON.parse(result.stdout);

        // Read full results if needed
        let fullResults = null;
        try {
            const resultContent = await fs.readFile(outputPath, 'utf-8');
            fullResults = JSON.parse(resultContent);
        } catch (e) {
            console.error('Could not read full results:', e);
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

    } catch (error) {
        // Clean up on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

/**
 * Run Python script and capture output
 * @param {string[]} args - Command arguments
 * @param {number} timeout - Timeout in ms (default 5 min)
 */
function runPythonScript(args, timeout = 300000) {
    return new Promise((resolve, reject) => {
        const python = spawn('python3', args, {
            cwd: FANALYS_PATH,
            env: { ...process.env },  // Pass environment variables (API keys)
            timeout: timeout
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

// ============================================
// Express route example
// ============================================

/**
 * Example Express route handler
 *
 * Expects:
 * - req.body.inputData: JSON from data collection
 * - req.file or req.body.nyproduktionFile: Optional Excel file path
 */
async function handleQuickAnalysis(req, res) {
    try {
        const { inputData } = req.body;

        // Get nyproduktion file path from state/request
        // This could be from multer upload or a path in the request
        const nyproduktionFile = req.body.nyproduktionFile || req.file?.path || null;

        if (!inputData) {
            return res.status(400).json({ error: 'inputData is required' });
        }

        console.log('Starting quick analysis...');
        const result = await runQuickAnalysis(inputData, nyproduktionFile);

        if (result.success) {
            res.json({
                success: true,
                recommendation: result.summary.recommendation,
                confidence: result.summary.confidence,
                rationale: result.summary.rationale,
                files: result.files,
                // Include key data for frontend display
                marketAnalysis: result.fullResults?.quick_market_output?.output,
                locationAnalysis: result.fullResults?.quick_location_output?.output,
                synthesis: result.fullResults?.quick_synthesis_output?.output
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.summary.error || 'Analysis failed'
            });
        }

    } catch (error) {
        console.error('Quick analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// ============================================
// Full analysis (11 agents, 6 phases)
// ============================================

/**
 * Run full analysis on input data
 *
 * @param {Object} inputData - JSON data from data collection
 * @param {string} nyproduktionFile - Optional path to Excel file with competing projects
 * @returns {Promise<Object>} Analysis result
 */
async function runFullAnalysis(inputData, nyproduktionFile = null) {
    // Create temp directory for this analysis
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fanalys-full-'));
    const inputPath = path.join(tempDir, 'input.json');
    const outputPath = path.join(tempDir, 'result.json');
    const pdfPath = path.join(tempDir, 'report_full.pdf');
    const executivePdfPath = path.join(tempDir, 'report_executive.pdf');

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
        if (nyproduktionFile) {
            args.push('--nyproduktion', nyproduktionFile);
        }

        // Run Python script (full analysis takes longer)
        const result = await runPythonScript(args, 900000);  // 15 min timeout

        // Parse the JSON output from stdout
        const summary = JSON.parse(result.stdout);

        // Read full results if needed
        let fullResults = null;
        try {
            const resultContent = await fs.readFile(outputPath, 'utf-8');
            fullResults = JSON.parse(resultContent);
        } catch (e) {
            console.error('Could not read full results:', e);
        }

        return {
            success: summary.status === 'completed',
            summary,
            fullResults,
            files: {
                json: outputPath,
                pdf: summary.pdf_file,
                executivePdf: summary.executive_pdf_file,
                map: summary.map_file
            }
        };

    } catch (error) {
        // Clean up on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

/**
 * Example Express route handler for FULL analysis
 *
 * Expects:
 * - req.body.inputData: JSON from data collection
 * - req.file or req.body.nyproduktionFile: Optional Excel file path
 */
async function handleFullAnalysis(req, res) {
    try {
        const { inputData } = req.body;

        // Get nyproduktion file path from state/request
        const nyproduktionFile = req.body.nyproduktionFile || req.file?.path || null;

        if (!inputData) {
            return res.status(400).json({ error: 'inputData is required' });
        }

        console.log('Starting full analysis (this may take 5-15 minutes)...');
        const result = await runFullAnalysis(inputData, nyproduktionFile);

        if (result.success) {
            res.json({
                success: true,
                // QA status
                qaDecision: result.summary.qa_decision,
                qaQualityScore: result.summary.qa_quality_score,
                // Report summary
                reportSummary: result.summary.report_summary,
                keyRecommendations: result.summary.key_recommendations,
                // Report stats
                fullReport: result.summary.full_report,
                executiveReport: result.summary.executive_report,
                // Files
                files: result.files,
                // Execution info
                totalExecutionTime: result.summary.total_execution_time_seconds,
                agentsExecuted: result.summary.agents_executed
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.summary.error || 'Analysis failed'
            });
        }

    } catch (error) {
        console.error('Full analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    runQuickAnalysis,
    runFullAnalysis,
    handleQuickAnalysis,
    handleFullAnalysis
};


// ============================================
// Usage example with Express
// ============================================
/*
const express = require('express');
const multer = require('multer');
const { handleQuickAnalysis, handleFullAnalysis, runQuickAnalysis, runFullAnalysis } = require('./fanalys-integration');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Route for quick analysis (2-3 min)
app.post('/api/analysis/quick', upload.single('nyproduktionFile'), handleQuickAnalysis);

// Route for full analysis (5-15 min)
app.post('/api/analysis/full', upload.single('nyproduktionFile'), handleFullAnalysis);

// Or if nyproduktionFile is already a path in state:
app.post('/api/analysis/quick', express.json(), async (req, res) => {
    const { inputData, nyproduktionFile } = req.body;
    // nyproduktionFile comes from your state

    const result = await runQuickAnalysis(inputData, nyproduktionFile);
    res.json(result);
});

app.post('/api/analysis/full', express.json(), async (req, res) => {
    const { inputData, nyproduktionFile } = req.body;
    // nyproduktionFile comes from your state

    const result = await runFullAnalysis(inputData, nyproduktionFile);
    res.json(result);
});

app.listen(3000);
*/
