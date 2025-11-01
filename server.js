const express = require('express');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3001;

console.log('Server script starting...');

app.use(cors());
app.use(bodyParser.json());

console.log('Middleware configured.');

// Endpoint to handle code reviews
app.post('/api/review', (req, res) => {
  try {
    console.log('Received request on /api/review');
    const { code, filename, model } = req.body;

    if (!code) {
      console.log('Request failed: Code is missing.');
      return res.status(400).json({ error: 'Code is required.' });
    }

    const effectiveModel = model || 'llama3.2:3b'; // Use a default model
    console.log(`Starting Ollama review with model: ${effectiveModel}`);

    const prompt = `
      You are an expert code reviewer acting as a strict JSON API.
      A user has submitted a file named "${filename}".
      Your task is to analyze the code and provide feedback.

      The user's code is:
      \`\`\`
      ${code}
      \`\`\`

      Respond with ONLY a single, raw JSON object and nothing else. Do not add any conversational text, introductions, or explanations before or after the JSON.
      The JSON object MUST have this exact structure:
      {
        "verdict": "OK" or "NEEDS_IMPROVEMENT",
        "explanation": "A concise, one-paragraph explanation of your findings. Explain potential issues, bugs, or areas for improvement.",
        "correctedCode": "The full, corrected, or improved version of the code. If no changes are needed, return the original code."
      }
      IMPORTANT: Ensure all strings in the JSON are properly escaped. For example, all backslashes (\\) must be written as double backslashes (\\\\).
    `;

    const ollamaProcess = spawn('ollama', ['run', effectiveModel]);

    let responseData = '';
    let errorData = '';

    ollamaProcess.stdout.on('data', (data) => {
      responseData += data.toString();
    });

    ollamaProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.error(`Ollama stderr: ${data}`); // Log errors in real-time
    });

    ollamaProcess.on('close', (code) => {
      console.log(`Ollama process finished with exit code: ${code}`);
      if (code !== 0) {
        return res.status(500).json({ error: 'Failed to run Ollama review.', details: errorData });
      }

      try {
        const jsonMatch = responseData.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No valid JSON object found in Ollama's response.");
        }
        const result = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed Ollama response.');
        res.json(result);
      } catch (e) {
        console.error("Fatal: Failed to parse Ollama response.", e.message);
        res.status(500).json({ error: "Failed to parse the review from Ollama.", details: responseData });
      }
    });

    ollamaProcess.stdin.write(prompt);
    ollamaProcess.stdin.end();

  } catch (e) {
    console.error('FATAL ERROR in /api/review handler:', e);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Full server is now listening on http://localhost:${port}`);
});