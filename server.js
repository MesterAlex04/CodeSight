const express = require('express');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3002; // <--- CHANGE THIS LINE

app.use(cors());
// Increase the payload size limit to allow for larger files
app.use(bodyParser.json({ limit: '10mb' }));

/**
 * A function that gets a review for a single file from Ollama.
 * Returns a Promise that resolves with the review data.
 */
function getOllamaReview(file, model) {
  return new Promise((resolve, reject) => {
    const { filename, code } = file;
    console.log(`Getting review for: ${filename}`);

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

    const ollamaProcess = spawn('ollama', ['run', model]);
    let responseData = '';
    let errorData = '';

    ollamaProcess.stdout.on('data', (data) => { responseData += data.toString(); });
    ollamaProcess.stderr.on('data', (data) => { errorData += data.toString(); });

    ollamaProcess.on('close', (exitCode) => {
      if (exitCode !== 0) {
        console.error(`Ollama failed for ${filename}: ${errorData}`);
        return reject(new Error(`Ollama process failed for ${filename}.`));
      }
      try {
        const jsonMatch = responseData.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No valid JSON object found in Ollama's response.");
        const result = JSON.parse(jsonMatch[0]);
        // Combine the original filename with the review result
        resolve({ filename, review: result });
      } catch (e) {
        console.error(`Failed to parse Ollama response for ${filename}: ${e.message}`);
        reject(new Error(`Failed to parse review for ${filename}.`));
      }
    });

    ollamaProcess.stdin.write(prompt);
    ollamaProcess.stdin.end();
  });
}

// The main endpoint, now updated to handle multiple files
app.post('/api/review', async (req, res) => {
  const { files, model } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'An array of files is required.' });
  }

  const effectiveModel = model || 'qwen2.5:0.5b'; // Changed from llama3.2:3b
  console.log(`Received review request for ${files.length} file(s).`);

  try {
    // Process all file reviews in parallel
    const reviewPromises = files.map(file => getOllamaReview(file, effectiveModel));
    const results = await Promise.all(reviewPromises);
    res.json(results);
  } catch (e) {
    console.error('An error occurred during batch review:', e);
    res.status(500).json({ error: 'Failed to complete all reviews.', details: e.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Multi-file server is now listening on http://localhost:${port}`); // This will now show port 3002
});