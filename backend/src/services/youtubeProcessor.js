/**
 * YouTube Processing Service
 * Responsible for extracting transcripts from YouTube videos and processing them for storage
 */

const { v4: uuidv4 } = require('uuid');
const youtubeDl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const { chunkByParagraphs } = require('../utils/textChunker');
const { generateEmbeddings } = require('./embedding');
const { addItem } = require('./database');
const { createContextLogger } = require('../utils/logger');
const logger = createContextLogger('YouTubeProcessor');

// Define temp directory path
const TEMP_DIR = path.resolve(__dirname, '../../../temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  logger.debug(`Created temp directory at: ${TEMP_DIR}`);
}

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
    logger.error('Error extracting YouTube video ID', { 
      url, 
      error: error.message 
    });
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
    logger.info(`Processing YouTube URL: ${url}`);
    
    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      logger.error(`Invalid YouTube URL: ${url}`);
      throw new Error(`Invalid YouTube URL: ${url}`);
    }
    
    logger.debug(`Extracted video ID: ${videoId}`);
    
    // Fetch video info using youtube-dl-exec
    logger.debug(`Fetching video info for ID: ${videoId}`);
    const videoInfo = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });
    
    if (!videoInfo) {
      logger.error(`Failed to fetch video info: ${url}`);
      throw new Error(`Failed to fetch video info: ${url}`);
    }
    
    logger.debug(`Successfully fetched video info`, {
      title: videoInfo.title,
      channel: videoInfo.channel || videoInfo.uploader,
      duration: videoInfo.duration,
      hasSubtitles: !!(videoInfo.subtitles && Object.keys(videoInfo.subtitles).length > 0),
      hasAutoCaptions: !!(videoInfo.automatic_captions && Object.keys(videoInfo.automatic_captions).length > 0)
    });
    
    // Get the transcript/subtitles
    let transcript = '';
    
    // Try to get subtitles if available
    if (videoInfo.subtitles && Object.keys(videoInfo.subtitles).length > 0) {
      // Prefer English subtitles if available
      const subtitleLang = videoInfo.subtitles.en || 
                         videoInfo.subtitles.en_US || 
                         videoInfo.subtitles[Object.keys(videoInfo.subtitles)[0]];
      
      if (subtitleLang && subtitleLang.length > 0) {
        logger.info(`Found subtitles for video: ${videoId}`);
        
        // Use youtube-dl-exec to write the subtitles to a temp file and read them
        const tempSubtitlePath = path.join(TEMP_DIR, `subtitle_${videoId}.vtt`);
        
        try {
          await youtubeDl(url, {
            skipDownload: true,
            writeSub: true,
            subLang: 'en',
            subFormat: 'vtt',
            output: tempSubtitlePath
          });
          
          // Read the VTT file and extract just the text
          if (fs.existsSync(tempSubtitlePath)) {
            const vttContent = fs.readFileSync(tempSubtitlePath, 'utf8');
            
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
            logger.debug(`Extracted transcript from subtitles`, { 
              charCount: transcript.length,
              path: tempSubtitlePath
            });
            
            // Clean up
            fs.unlinkSync(tempSubtitlePath);
          } else {
            logger.debug(`Subtitle file not found at: ${tempSubtitlePath}`);
          }
        } catch (error) {
          logger.warn(`Error extracting subtitles: ${error.message}`);
        }
      }
    }
    
    // If we couldn't get subtitles, use the automatic captions
    if (!transcript && videoInfo.automatic_captions) {
      const captionLang = videoInfo.automatic_captions.en || 
                        videoInfo.automatic_captions.en_US || 
                        videoInfo.automatic_captions[Object.keys(videoInfo.automatic_captions)[0]];
      
      if (captionLang && captionLang.length > 0) {
        logger.info(`Using automatic captions for video: ${videoId}`);
        
        // Use similar approach as above but with different options
        const tempCaptionPath = path.join(TEMP_DIR, `caption_${videoId}.vtt.en.vtt`);
        const tempOutputBase = path.join(TEMP_DIR, `caption_${videoId}`);
        
        try {
          await youtubeDl(url, {
            skipDownload: true,
            writeAutoSub: true,
            subLang: 'en',
            subFormat: 'vtt',
            output: tempOutputBase
          });
          
          // Try multiple possible filename patterns that youtube-dl might create
          const possiblePaths = [
            tempCaptionPath,
            path.join(TEMP_DIR, `caption_${videoId}.en.vtt`),
            path.join(TEMP_DIR, `caption_${videoId}.vtt`),
            path.join(TEMP_DIR, `temp_caption_${videoId}.vtt.en.vtt`)
          ];
          
          // Find the first file that exists
          let existingFile = null;
          for (const filePath of possiblePaths) {
            if (fs.existsSync(filePath)) {
              existingFile = filePath;
              break;
            }
          }
          
          // If no specific file found, check for any .vtt files in temp dir with the video ID
          if (!existingFile) {
            const files = fs.readdirSync(TEMP_DIR);
            for (const file of files) {
              if (file.includes(videoId) && file.endsWith('.vtt')) {
                existingFile = path.join(TEMP_DIR, file);
                break;
              }
            }
          }
          
          // Fall back to checking current directory for the file
          if (!existingFile) {
            const currentDirFile = `./temp_caption_${videoId}.vtt.en.vtt`;
            if (fs.existsSync(currentDirFile)) {
              existingFile = currentDirFile;
              
              // Move it to the temp directory for consistency
              fs.copyFileSync(currentDirFile, tempCaptionPath);
              fs.unlinkSync(currentDirFile);
              existingFile = tempCaptionPath;
            }
          }
          
          if (existingFile) {
            logger.debug(`Found caption file at: ${existingFile}`);
            const vttContent = fs.readFileSync(existingFile, 'utf8');
            
            const textLines = vttContent
              .split('\n')
              .filter(line => 
                !line.includes('-->') && 
                !line.match(/^\d+$/) && 
                !line.startsWith('WEBVTT') && 
                line.trim() !== ''
              );
            
            transcript = textLines.join(' ');
            logger.debug(`Extracted transcript from automatic captions`, { 
              charCount: transcript.length,
              path: existingFile
            });
            
            // Clean up
            fs.unlinkSync(existingFile);
          } else {
            logger.warn(`No caption file found for video ID: ${videoId}`);
          }
        } catch (error) {
          logger.warn(`Error extracting automatic captions: ${error.message}`);
        }
      }
    }
    
    // Clean up any leftover temp files with this video ID
    const tempFiles = fs.readdirSync(TEMP_DIR);
    tempFiles.forEach(file => {
      if (file.includes(videoId)) {
        try {
          fs.unlinkSync(path.join(TEMP_DIR, file));
          logger.debug(`Cleaned up temp file: ${file}`);
        } catch (err) {
          logger.warn(`Failed to clean up temp file: ${file}`, { error: err.message });
        }
      }
    });
    
    // If we still don't have a transcript, throw an error
    if (!transcript) {
      logger.error(`No transcript available for video: ${url}`);
      throw new Error(`No transcript available for video: ${url}`);
    }
    
    // Extract basic info
    const extractedText = transcript;
    const title = videoInfo.title || `YouTube Video: ${videoId}`;
    
    // Generate a unique ID
    const id = uuidv4();
    logger.debug(`Generated ID for document: ${id}`);
    
    // Chunk the text
    const textChunks = chunkByParagraphs(extractedText);
    logger.info(`Split into ${textChunks.length} chunks`);
    
    // Generate embeddings for each chunk
    const chunkEmbeddings = await generateEmbeddings(textChunks);
    logger.info(`Generated ${chunkEmbeddings.length} embeddings`);
    
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
    logger.info(`YouTube video processed and stored with ID: ${id}`);
    
    return item;
  } catch (error) {
    logger.error('Error processing YouTube URL', { 
      url,
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

module.exports = {
  processYouTube
}; 