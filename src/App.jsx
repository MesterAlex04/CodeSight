import React, { useState, useEffect } from "react";

const LoadingSpinner = ({ gifUrl }) => (
  <div className="loading-overlay">
    {gifUrl ? (
      <img src={gifUrl} alt="AI is thinking..." className="loading-gif" />
    ) : (
      <div className="loading-fallback-spinner"></div>
    )}
    <p className="loading-text">Analyzing Code...</p>
  </div>
);

export default function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingGif, setLoadingGif] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    if (loading) {
      const fetchGif = async () => {
        const giphyApiKey = "V4VZML7UAMIJsu7igPwuCVa2xKuyLkyW"; // IMPORTANT: Replace with your key
        if (giphyApiKey === "V4VZML7UAMIJsu7igPwuCVa2xKuyLkyW") {
          console.warn("GIPHY API Key is not set. Using a fallback spinner.");
          return;
        }
        try {
          const response = await fetch(`https://api.giphy.com/v1/gifs/random?api_key=${giphyApiKey}&tag=robot thinking computer&rating=g`);
          const data = await response.json();
          if (data.data.images?.original?.url) {
            setLoadingGif(data.data.images.original.url);
          }
        } catch (err) {
          console.error("Failed to fetch GIF from GIPHY:", err);
        }
      };
      fetchGif();
    } else {
      setLoadingGif('');
    }
  }, [loading]);

  const handleFileChange = (event) => {
    setResults([]);
    setError(null);
    setSelectedFiles(Array.from(event.target.files));
  };

  const handleDragOver = (event) => event.preventDefault();
  const handleDragEnter = (event) => { event.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = (event) => { event.preventDefault(); setIsDraggingOver(false); };
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDraggingOver(false);
    setResults([]);
    setError(null);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) setSelectedFiles(files);
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  async function runReview() {
    if (selectedFiles.length === 0) {
      setError("Please select one or more files to review.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const filesToReview = await Promise.all(
        selectedFiles.map(async (file) => ({
          filename: file.name,
          code: await readFileAsText(file),
        }))
      );
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: filesToReview,
          model: "qwen2.5:0.5b", // Changed from llama3.2:3b
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: `Request failed with status: ${response.status}` }));
        throw new Error(errData.error || "An unknown server error occurred.");
      }
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-container">
      {loading && <LoadingSpinner gifUrl={loadingGif} />}
      <h1>CodeSight AI Review</h1>
      
      <div className="input-area">
        <label
          htmlFor="file-upload"
          className={`file-upload-label ${isDraggingOver ? "drag-over" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <span>
            {isDraggingOver
              ? "Release to Drop Files"
              : selectedFiles.length === 0
              ? "Select Files or Drag & Drop Here"
              : `${selectedFiles.length} file(s) selected`}
          </span>
        </label>
        <input id="file-upload" type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        
        {selectedFiles.length > 0 && (
          <ul className="file-list">
            {selectedFiles.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        )}
        
        <button onClick={runReview} disabled={loading || selectedFiles.length === 0}>
          {loading ? "Analyzing..." : "Run Review"}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {results.length > 0 && (
        <div className="results-list">
          <h2>Review Results</h2>
          {results.map((result) => (
            <div key={result.filename} className="results-area">
              <h3>{result.filename}</h3>
              <div className={`verdict ${result.review.verdict?.toLowerCase()}`}>
                <strong>Verdict:</strong> {result.review.verdict}
              </div>
              <h4>Explanation</h4>
              <p>{result.review.explanation}</p>
              <h4>Suggested Code</h4>
              <pre><code>{result.review.correctedCode}</code></pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}