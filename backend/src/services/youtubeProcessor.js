/**
 * YouTube Processing Service
 * Responsible for extracting transcripts from YouTube videos and processing them for storage
 */

const { v4: uuidv4 } = require('uuid');
const youtubeDl = require('youtube-dl-exec');
const { chunkByParagraphs } = require('../utils/textChunker');
const { generateEmbeddings } = require('./embedding');
const { addItem } = require('./database');

/**
 * Extract YouTube video ID from URL
 * @param {string} url YouTube URL
 * @returns {string|null} YouTube video ID or null if not found
 */
function extractVideoId(url) {
  try {
    const urlObj = new URL(url);
    
    // Standard YouTube URL format
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      // Regular video URL: youtube.com/watch?v=VIDEO_ID
      if (urlObj.pathname === '/watch') {
        return urlObj.searchParams.get('v');
      }
      
      // Shortened (/v/) URL: youtube.com/v/VIDEO_ID
      if (urlObj.pathname.startsWith('/v/')) {
        return urlObj.pathname.split('/')[2];
      }
      
      // Embedded URL: youtube.com/embed/VIDEO_ID
      if (urlObj.pathname.startsWith('/embed/')) {
        return urlObj.pathname.split('/')[2];
      }
    }
    
    // YouTube Shortened URL: youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.substring(1); // Remove the leading '/'
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting YouTube video ID:', error);
    return null;
  }
}

/**
 * Process a YouTube video URL
 * @param {string} url URL of the YouTube video to process
 * @returns {Promise<Object>} The processed item with ID
 */
async function processYouTube(url) {
  try {
    console.log(`Processing YouTube URL: ${url}`);
    
    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }
    
    // Fetch video info using youtube-dl-exec
    const videoInfo = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });
    
    if (!videoInfo) {
      throw new Error(`Failed to fetch video info: ${url}`);
    }
    
    // Get the transcript/subtitles
    let transcript = '';
    
    // Try to get subtitles if available
    if (videoInfo.subtitles && Object.keys(videoInfo.subtitles).length > 0) {
      // Prefer English subtitles if available
      const subtitleLang = videoInfo.subtitles.en || 
                         videoInfo.subtitles.en_US || 
                         videoInfo.subtitles[Object.keys(videoInfo.subtitles)[0]];
      
      if (subtitleLang && subtitleLang.length > 0) {
        // Use youtube-dl-exec to write the subtitles to a temp file and read them
        const tempSubtitlePath = `./temp_subtitle_${videoId}.vtt`;
        
        await youtubeDl(url, {
          skipDownload: true,
          writeAutoSub: true,
          subFormat: 'vtt',
          output: tempSubtitlePath
        });
        
        // Read the VTT file and extract just the text
        if (require('fs').existsSync(tempSubtitlePath)) {
          const vttContent = require('fs').readFileSync(tempSubtitlePath, 'utf8');
          
          // Simple VTT parsing - extract text lines (skip timings and headers)
          const textLines = vttContent
            .split('\n')
            .filter(line => 
              !line.includes('-->') && 
              !line.match(/^\d+$/) && // Skip line numbers
              !line.startsWith('WEBVTT') && 
              line.trim() !== ''
            );
          
          transcript = textLines.join(' ');
          
          // Clean up
          require('fs').unlinkSync(tempSubtitlePath);
        }
      }
    }
    
    // If we couldn't get subtitles, use the automatic captions
    if (!transcript && videoInfo.automatic_captions) {
      const captionLang = videoInfo.automatic_captions.en || 
                        videoInfo.automatic_captions.en_US || 
                        videoInfo.automatic_captions[Object.keys(videoInfo.automatic_captions)[0]];
      
      if (captionLang && captionLang.length > 0) {
        // Use similar approach as above
        const tempCaptionPath = `./temp_caption_${videoId}.vtt`;
        
        await youtubeDl(url, {
          skipDownload: true,
          writeAutoSub: true,
          subFormat: 'vtt',
          output: tempCaptionPath
        });
        
        if (require('fs').existsSync(tempCaptionPath)) {
          const vttContent = require('fs').readFileSync(tempCaptionPath, 'utf8');
          
          const textLines = vttContent
            .split('\n')
            .filter(line => 
              !line.includes('-->') && 
              !line.match(/^\d+$/) && 
              !line.startsWith('WEBVTT') && 
              line.trim() !== ''
            );
          
          transcript = textLines.join(' ');
          
          // Clean up
          require('fs').unlinkSync(tempCaptionPath);
        }
      }
    }
    
    // If we still don't have a transcript, throw an error
    if (!transcript) {
      throw new Error(`No transcript available for video: ${url}`);
    }
    
    // Extract basic info
    const extractedText = transcript;
    const title = videoInfo.title || `YouTube Video: ${videoId}`;
    
    // Generate a unique ID
    const id = uuidv4();
    
    // Chunk the text
    const textChunks = chunkByParagraphs(extractedText);
    console.log(`Split into ${textChunks.length} chunks`);
    
    // Generate embeddings for each chunk
    const chunkEmbeddings = await generateEmbeddings(textChunks);
    console.log(`Generated ${chunkEmbeddings.length} embeddings`);
    
    // Create the database item
    const item = {
      id,
      source_type: 'youtube',
      source_identifier: url,
      title,
      original_content_path: url,
      extracted_text: extractedText,
      text_chunks: textChunks,
      // Use first chunk's embedding as the primary vector for the document
      vector: chunkEmbeddings[0] || [],
      metadata: {
        video_id: videoId,
        url,
        channel: videoInfo.channel || videoInfo.uploader || '',
        upload_date: videoInfo.upload_date || '',
        duration: videoInfo.duration || 0,
        view_count: videoInfo.view_count || 0,
        extraction_date: new Date().toISOString(),
        chunk_count: textChunks.length
      }
    };
    
    // Store in database
    await addItem(item);
    console.log(`YouTube video processed and stored with ID: ${id}`);
    
    return item;
  } catch (error) {
    console.error('Error processing YouTube URL:', error);
    throw error;
  }
}

module.exports = {
  processYouTube
}; 