import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../lib/api';

/**
 * CloudinaryUpload Component
 * 
 * A self-contained, production-ready React component for uploading images directly to Cloudinary
 * using the Unsigned Upload API.
 * 
 * Features:
 * - Theme Uniformity: Matches the warm South Indian sandalwood and maroon palette of the application.
 * - Horizontal Layout: Side-by-side wide panels to avoid scrolling on desktop screens.
 * - Person Selection: Replaces manual PID textbox with a custom sandalwood Searchable Select dropdown.
 * - Photo Status: Checks for existing profile photos for the selected person.
 * - Delete Association: Allows deleting the existing photo connection by setting photoUrl to ''.
 * - Auto-Link: Automatically assigns the secure Cloudinary URL to the selected profile upon successful upload.
 * - Direct unsigned upload to Cloudinary.
 * - Dynamic XMLHttpRequests implementation to support upload progress tracking.
 * - Validation for file types (jpg, jpeg, png) and max file size (2 MB).
 * - Read-only copyable textboxes for Cloudinary URL and Public ID.
 * - Dynamic image preview (local preview before upload, Cloudinary secure URL preview after upload).
 * - Comprehensive status indicators (Success, Error, Info) and progress bar.
 */
const CloudinaryUpload = ({ profiles = [], setProfiles }) => {
  // --- ENVIRONMENT CONFIG ---
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // --- COMPONENT STATE ---
  const [pid, setPid] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error'|'info', text: string }
  const [uploadResult, setUploadResult] = useState(null); // Cloudinary metadata
  const [cacheBuster, setCacheBuster] = useState(Date.now()); // Timestamp to bust browser cache on update

  // --- CROPPING STATE ---
  const [zoom, setZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgRatio, setImgRatio] = useState(1);
  const [rotation, setRotation] = useState(0); // Image rotation in degrees (0, 90, 180, 270)
  const [uploadType, setUploadType] = useState('profile'); // 'profile' or 'gallery'
  const [avatarSize, setAvatarSize] = useState(600); // Output avatar resolution (400, 600, or 800)
  const [uploadService, setUploadService] = useState(() => {
    const envVal = import.meta.env.VITE_UPLOAD_SERVICE;
    if (envVal) return envVal;
    return (cloudName && uploadPreset) ? 'cloudinary' : 'local';
  });

  // --- DROPDOWN STATE ---
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');

  // --- UX INTERACTIVE STATE ---
  const [isDragging, setIsDragging] = useState(false);
  const [activeInput, setActiveInput] = useState(false);
  const [isHoveredUpload, setIsHoveredUpload] = useState(false);
  const [isHoveredReset, setIsHoveredReset] = useState(false);

  // --- REFS ---
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const xhrRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Clean up local Object URL on unmount or when previewUrl changes to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Cancel any ongoing upload on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
    };
  }, []);

  // Store previous PID to know when the selected person changes
  const prevPidRef = useRef('');

  // Sync preview URL and reset states when selected PID changes or profiles update
  useEffect(() => {
    // 1. If the selected person has changed, reset the upload states
    if (pid !== prevPidRef.current) {
      prevPidRef.current = pid;
      setUploadProgress(0);
      setUploadResult(null);
      setStatus(null);
      // We do NOT reset selectedFile here so the user can crop the same group photo for multiple profiles!
      // Instead, we reset the zoom and pan offsets so they can crop the next person's face cleanly.
      setZoom(1);
      setImageOffset({ x: 0, y: 0 });
    }

    // 2. Sync previewUrl with the database photo if the user is not choosing a local file
    if (!selectedFile) {
      if (pid) {
        const selectedPerson = profiles.find(p => p.pid === pid);
        if (selectedPerson && selectedPerson.photoUrl) {
          setPreviewUrl(selectedPerson.photoUrl);
        } else {
          setPreviewUrl('');
        }
      } else {
        setPreviewUrl('');
      }
    }
  }, [pid, profiles, selectedFile]);

  // --- FIND SELECTED PERSON DETAILS ---
  const selectedPersonData = profiles.find(p => p.pid === pid);
  const hasExistingPhoto = !!(selectedPersonData && selectedPersonData.photoUrl);

  // Cache buster for displaying fresh images after overwrite
  const getBustedUrl = (url) => {
    if (!url) return '';
    // Only bust Cloudinary URLs
    if (url.includes('cloudinary.com')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}t=${cacheBuster}`;
    }
    return url;
  };

  // --- IMAGE LOADING & CROP HELPERS ---
  const loadImageDetails = (fileUrl) => {
    const img = new Image();
    // Only set crossOrigin for profile photos which are cropped via Canvas.
    // Gallery mode uploads original image directly without canvas, bypassing browser CORS block.
    if (uploadType === 'profile') {
      img.crossOrigin = 'anonymous';
    }
    img.src = fileUrl;
    img.onload = () => {
      setImgRatio(img.width / img.height);
      setZoom(1);
      setImageOffset({ x: 0, y: 0 });
      setRotation(0); // Reset rotation for new files
    };
  };

  const getImageStyles = () => {
    const containerSize = 280;
    let width, height;

    if (imgRatio > 1) {
      // Landscape
      height = containerSize;
      width = containerSize * imgRatio;
    } else {
      // Portrait
      width = containerSize;
      height = containerSize / imgRatio;
    }

    // Apply zoom
    const finalW = width * zoom;
    const finalH = height * zoom;

    // Apply offset and center positioning inside container
    const left = (containerSize - finalW) / 2 + imageOffset.x;
    const top = (containerSize - finalH) / 2 + imageOffset.y;

    return {
      width: `${finalW}px`,
      height: `${finalH}px`,
      left: `${left}px`,
      top: `${top}px`,
      transform: `rotate(${rotation}deg)`,
      transformOrigin: 'center center',
      transition: isDraggingImage ? 'none' : 'transform 0.25s ease', // Smooth rotation animations
    };
  };

  const handleDragStart = (e) => {
    if (!selectedFile) return;
    setIsDraggingImage(true);
    
    // Support mouse & mobile touch client coords
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    setDragStart({
      clientX,
      clientY,
      offsetX: imageOffset.x,
      offsetY: imageOffset.y
    });
  };

  const handleDragMove = (e) => {
    if (!isDraggingImage) return;
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    const dx = clientX - dragStart.clientX;
    const dy = clientY - dragStart.clientY;

    let finalDx = dx;
    let finalDy = dy;

    // Adjust delta movement direction based on current image rotation
    if (rotation === 90) {
      finalDx = dy;
      finalDy = -dx;
    } else if (rotation === 180) {
      finalDx = -dx;
      finalDy = -dy;
    } else if (rotation === 270) {
      finalDx = -dy;
      finalDy = dx;
    }

    setImageOffset({
      x: dragStart.offsetX + finalDx,
      y: dragStart.offsetY + finalDy
    });
  };

  const handleDragEnd = () => {
    setIsDraggingImage(false);
  };

  const handleResetCrop = () => {
    setZoom(1);
    setImageOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  const generateCroppedBlob = () => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = previewUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = avatarSize;
        canvas.height = avatarSize;
        const ctx = canvas.getContext('2d');

        const containerSize = 280;
        const cropOffset = 10;
        const cropSize = 260; // Circular overlay is sized 260px (container width 280 minus 10px padding on each side)

        // Calculate original render size inside the 280px container
        const imgRatio = img.width / img.height;
        let renderW, renderH;
        if (imgRatio > 1) {
          renderH = containerSize;
          renderW = containerSize * imgRatio;
        } else {
          renderW = containerSize;
          renderH = containerSize / imgRatio;
        }

        const finalW = renderW * zoom;
        const finalH = renderH * zoom;

        // Viewport center position offset
        const defaultX = (containerSize - finalW) / 2;
        const defaultY = (containerSize - finalH) / 2;
        
        const finalX = defaultX + imageOffset.x;
        const finalY = defaultY + imageOffset.y;

        // Calculate position relative to the crop viewport center (140, 140)
        // Scaled to match the dynamic output canvas resolution relative to the 260px crop size
        const scaleFactor = avatarSize / cropSize;
        const dx = (finalX - 140) * scaleFactor;
        const dy = (finalY - 140) * scaleFactor;
        const dw = finalW * scaleFactor;
        const dh = finalH * scaleFactor;

        // Fill background with white for transparent portions
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, avatarSize, avatarSize);

        // Center context at canvas midpoint and rotate
        const midpoint = avatarSize / 2;
        ctx.translate(midpoint, midpoint);
        ctx.rotate((rotation * Math.PI) / 180);

        // Draw rotated image relative to translated midpoint
        ctx.drawImage(
          img,
          dx,
          dy,
          dw,
          dh
        );

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob returned null'));
          }
        }, 'image/jpeg', 0.95); // High quality Jpeg export
      };
      img.onerror = (err) => reject(err);
    });
  };

  // Filter profiles that are missing a photo url
  const missingPhotoProfiles = profiles.filter(p => !p.photoUrl || p.photoUrl.trim() === '');

  // Prepare searchable options
  const peopleOptions = profiles.map(p => ({
    pid: p.pid,
    name: `${p.firstName} ${p.surName}`,
    gender: p.gender,
    photoUrl: p.photoUrl
  }));

  const filteredPeople = peopleOptions.filter(person => 
    person.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
    person.pid.toLowerCase().includes(peopleSearch.toLowerCase())
  );

  // --- VALIDATION HELPER ---
  const validateFile = (file) => {
    if (!file) {
      return 'Please select an image file.';
    }
    if (file.isVirtual) {
      return null;
    }

    // Check file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    const fileNameParts = file.name.split('.');
    const fileExtension = fileNameParts.length > 1 ? fileNameParts.pop().toLowerCase() : '';

    if (!allowedExtensions.includes(fileExtension)) {
      return 'Invalid file type. Only JPG, JPEG, and PNG are allowed.';
    }

    // Check MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.type)) {
      return 'Invalid file format. Only JPG, JPEG, and PNG images are allowed.';
    }

    // Check file size (Maximum 2 MB = 2 * 1024 * 1024 bytes)
    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return 'File is too large. Maximum allowed size is 2 MB.';
    }

    return null;
  };

  // --- EVENT HANDLERS ---
  const handleChoosePhotoClick = () => {
    if (isUploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setStatus({ type: 'error', text: validationError });
      setSelectedFile(null);
      setPreviewUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      loadImageDetails(objectUrl);
      setUploadProgress(0);
      setUploadResult(null);
      setStatus(null); // Clear previous errors
      setImageUrlInput(''); // Clear URL input when a local file is chosen
    }
  };

  const handleLoadUrl = () => {
    if (!imageUrlInput.trim()) return;
    setStatus(null);
    setUploadResult(null);
    setUploadProgress(0);

    const url = imageUrlInput.trim();

    // Set selectedFile to virtual representation
    setSelectedFile({
      name: url.split('/').pop().split('?')[0] || 'remote-image.jpg',
      type: 'image/jpeg',
      size: 0,
      isVirtual: true
    });

    setPreviewUrl(url);
    loadImageDetails(url);
  };

  // Drag and drop handlers for premium user experience
  const handleDragOver = (e) => {
    e.preventDefault();
    if (isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isUploading) return;
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setStatus({ type: 'error', text: validationError });
      setSelectedFile(null);
      setPreviewUrl('');
    } else {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      loadImageDetails(objectUrl);
      setUploadProgress(0);
      setUploadResult(null);
      setStatus(null);
    }
  };

  const handleDeleteExistingPhoto = () => {
    if (!pid || !selectedPersonData) return;

    if (window.confirm(`Are you sure you want to remove the existing photo for ${selectedPersonData.firstName} ${selectedPersonData.surName}?`)) {
      if (setProfiles) {
        const updatedProfiles = profiles.map(p => {
          if (p.pid === pid) {
            const { photoUrl, ...rest } = p; // Remove photoUrl completely to match PhotoEditor.jsx
            return rest;
          }
          return p;
        });
        setProfiles(updatedProfiles);
      }

      // If the current preview is the existing photo, clear it
      if (previewUrl === selectedPersonData.photoUrl) {
        setPreviewUrl('');
      }

      setStatus({
        type: 'success',
        text: `Successfully deleted existing photo association for ${selectedPersonData.firstName}! Remember to click "Save to Server" / "Save Draft" at the top of the admin page to save changes permanently.`
      });
    }
  };

  const handleUpload = async () => {
    // Clear status
    setStatus(null);

    // 1. Validation: No PID (Only for Profile Photo)
    if (uploadType === 'profile' && !pid.trim()) {
      setStatus({ type: 'error', text: 'Validation Error: Please select a person to upload the photo for.' });
      return;
    }

    // 2. Validation: No Image
    if (!selectedFile) {
      setStatus({ type: 'error', text: 'Validation Error: No image chosen. Please select a photo.' });
      return;
    }

    // 3. Validation: Re-validate file just in case
    const fileError = validateFile(selectedFile);
    if (fileError) {
      setStatus({ type: 'error', text: `Validation Error: ${fileError}` });
      return;
    }

    // 4. Validation: Check configurations
    if (uploadService === 'cloudinary' && (!cloudName || !uploadPreset)) {
      setStatus({
        type: 'error',
        text: 'Configuration Error: Cloudinary settings are missing. Please define VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your environment.'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    let croppedBlob = null;
    
    // Only crop if purpose is profile photo
    if (uploadType === 'profile') {
      setStatus({ type: 'info', text: 'Processing and cropping image...' });
      try {
        croppedBlob = await generateCroppedBlob();
      } catch (err) {
        setIsUploading(false);
        setStatus({ type: 'error', text: 'Failed to process and crop image. Please try another file.' });
        return;
      }
    } else {
      setStatus({ type: 'info', text: 'Preparing image for upload...' });
    }

    setStatus(null); // Clear processing message

    // Create XMLHttpRequest to track upload progress
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    let uploadUrl;
    if (uploadService === 'local') {
      uploadUrl = import.meta.env.DEV ? '/api/upload' : getApiUrl();
    } else {
      uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    }

    xhr.open('POST', uploadUrl, true);

    // Track upload progress percentage
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded * 100) / e.total);
        setUploadProgress(percentComplete);
      }
    });

    // Handle upload complete
    xhr.onload = () => {
      setIsUploading(false);
      xhrRef.current = null;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          
          // Formatter for file size
          const formatBytes = (bytes, decimals = 2) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
          };

          // Update results
          setUploadResult({
            secureUrl: response.secure_url,
            publicId: response.public_id,
            uploadTime: new Date().toLocaleString(),
            width: response.width || 'N/A',
            height: response.height || 'N/A',
            fileSize: formatBytes(response.bytes || response.size || 0)
          });

          // Link new photo to the selected profile in the main state (Only for Profile mode)
          if (uploadType === 'profile' && pid && setProfiles) {
            const updatedProfiles = profiles.map(p => {
              if (p.pid === pid) {
                return { ...p, photoUrl: response.secure_url };
              }
              return p;
            });
            setProfiles(updatedProfiles);
          }

          if (uploadType === 'profile') {
            setStatus({
              type: 'success',
              text: uploadService === 'local'
                ? 'ఫోటో మీ సర్వర్‌లో విజయవంతంగా సేవ్ చేయబడింది మరియు ప్రొఫైల్‌కు లింక్ చేయబడింది! పేజీ పైభాగంలో ఉన్న "Save to Server" క్లిక్ చేయడం మర్చిపోకండి.'
                : 'Image uploaded successfully to Cloudinary and linked to profile! Remember to click "Save to Server" / "Save Draft" at the top of the page to save changes permanently.'
            });
          } else {
            setStatus({
              type: 'success',
              text: uploadService === 'local'
                ? 'గ్యాలరీ ఫోటో విజయవంతంగా మీ సర్వర్‌లో సేవ్ చేయబడింది! కింద ఉన్న "Copy" క్లిక్ చేసి, "Memories" పేజీలో "Photo URL" ఫీల్డ్‌లో పేస్ట్ చేసి సేవ్ చేయండి.'
                : 'గ్యాలరీ ఫోటో విజయవంతంగా అప్‌లోడ్ చేయబడింది! కింద ఉన్న "Copy" బటన్ క్లిక్ చేసి, వంశవృక్షం "Memories" పేజీలో "Photo URL (Optional)" ఫీల్డ్‌లో పేస్ట్ చేసి సేవ్ చేయండి.'
            });
          }
          setCacheBuster(Date.now()); // Update cache buster on successful upload
        } catch (err) {
          setStatus({
            type: 'error',
            text: 'Upload Succeeded but failed to parse response data.'
          });
        }
      } else {
        // Error details
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          const errorMessage = errorResponse.error || errorResponse.error?.message || `Status: ${xhr.status}`;
          setStatus({
            type: 'error',
            text: `Upload Error: ${errorMessage}`
          });
        } catch (e) {
          setStatus({
            type: 'error',
            text: `Upload Failed: Server returned status code ${xhr.status}`
          });
        }
      }
    };

    // Handle network error
    xhr.onerror = () => {
      setIsUploading(false);
      xhrRef.current = null;
      setStatus({
        type: 'error',
        text: 'Internet Error: A network connection failure occurred. Please verify your internet connection.'
      });
    };

    // Prepare FormData
    const formData = new FormData();

    if (uploadService === 'local') {
      const adminPassword = sessionStorage.getItem('vamsha_admin_pwd') || '';
      xhr.setRequestHeader('X-Admin-Password', adminPassword);
      
      formData.append('purpose', uploadType);
      if (uploadType === 'profile') {
        formData.append('file', croppedBlob, `${pid.trim()}.jpg`);
        formData.append('pid', pid.trim());
      } else {
        if (selectedFile.isVirtual) {
          formData.append('file', previewUrl);
        } else {
          formData.append('file', selectedFile);
        }
      }
    } else {
      formData.append('upload_preset', uploadPreset);
      formData.append('resource_type', 'image');

      if (uploadType === 'profile') {
        formData.append('file', croppedBlob, `${pid.trim()}.jpg`);
        formData.append('public_id', `${pid.trim()}_${Date.now()}`);
        formData.append('folder', 'vamsha');
      } else {
        // Gallery mode: no cropping
        if (selectedFile.isVirtual) {
          formData.append('file', previewUrl);
        } else {
          formData.append('file', selectedFile);
        }
        formData.append('public_id', `gallery_${Date.now()}`);
        formData.append('folder', 'vamsha/gallery');
      }
    }

    xhr.send(formData);
  };

  const handleReset = () => {
    // Abort active request if any
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }

    setPid('');
    setSelectedFile(null);
    setPreviewUrl('');
    setZoom(1);
    setImageOffset({ x: 0, y: 0 });
    setImgRatio(1);
    setUploadProgress(0);
    setIsUploading(false);
    setStatus(null);
    setUploadResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text, typeLabel) => {
    if (!text) return;
    
    const onSuccessfulCopy = () => {
      setStatus({
        type: 'success',
        text: `${typeLabel} successfully copied to clipboard!`
      });
    };

    const onErrorCopy = () => {
      setStatus({
        type: 'error',
        text: `Failed to copy ${typeLabel} to clipboard.`
      });
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(onSuccessfulCopy)
        .catch(() => fallbackCopy(text, onSuccessfulCopy, onErrorCopy));
    } else {
      fallbackCopy(text, onSuccessfulCopy, onErrorCopy);
    }
  };

  const fallbackCopy = (text, successCb, errorCb) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Position outside of viewport
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        successCb();
      } else {
        errorCb();
      }
    } catch (err) {
      errorCb();
    }

    document.body.removeChild(textArea);
  };

  // --- STYLES OBJECT (UNIFORM LIGHT sand THEME) ---
  const styles = {
    container: {
      fontFamily: 'var(--font-main), "Outfit", "Inter", sans-serif',
      width: '100%',
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '12px',
      border: '1px solid var(--color-sandalwood, #EADDCA)',
      boxShadow: '0 4px 20px rgba(99, 19, 29, 0.05)',
      boxSizing: 'border-box',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
      borderBottom: '2px solid var(--color-sandalwood, #EADDCA)',
      paddingBottom: '1rem',
    },
    title: {
      color: 'var(--color-maroon, #63131D)',
      fontSize: '1.5rem',
      margin: 0,
      fontWeight: '600',
    },
    rowLayout: {
      display: 'flex',
      flexDirection: 'row',
      gap: '2.5rem',
      flexWrap: 'wrap',
    },
    leftPanel: {
      flex: '1 1 300px',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    },
    rightPanel: {
      flex: '1 1 300px',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
    },
    label: {
      fontSize: '0.8rem',
      fontWeight: '700',
      color: 'var(--color-maroon, #63131D)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.35rem',
    },
    input: {
      padding: '0.5rem 0.75rem',
      borderRadius: '8px',
      border: '1px solid var(--color-sandalwood, #EADDCA)',
      backgroundColor: 'white',
      color: 'var(--color-dark, #2C1818)',
      fontSize: '0.88rem',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s',
    },
    dropzone: {
      border: isDragging 
        ? '2px dashed var(--color-maroon, #63131D)' 
        : '2px dashed var(--color-gold, #D4AF37)',
      borderRadius: '12px',
      padding: '1.25rem 1rem',
      textAlign: 'center',
      cursor: 'pointer',
      backgroundColor: '#FAF8F5',
      transition: 'all 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.4rem',
    },
    dropzoneTitle: {
      fontSize: '0.85rem',
      fontWeight: '600',
      color: 'var(--color-dark, #2C1818)',
      margin: 0,
    },
    dropzoneSubtitle: {
      fontSize: '0.72rem',
      color: '#666',
      margin: 0,
    },
    btnChoose: {
      padding: '0.45rem 1rem',
      borderRadius: '6px',
      border: '1px solid var(--color-sandalwood, #EADDCA)',
      backgroundColor: 'white',
      color: 'var(--color-dark, #2C1818)',
      fontSize: '0.8rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    previewContainer: {
      borderRadius: '12px',
      overflow: selectedFile ? 'visible' : 'hidden',
      border: '1px solid var(--color-sandalwood, #EADDCA)',
      backgroundColor: '#FAF8F5',
      aspectRatio: selectedFile ? 'auto' : '16/10',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: selectedFile ? '1.25rem 1rem' : '0',
    },
    previewImage: {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
    },
    emptyPreview: {
      color: '#999',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.4rem',
      fontSize: '0.85rem',
    },
    progressArea: {
      marginBottom: '0.5rem',
    },
    progressHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '0.8rem',
      fontWeight: '600',
      color: 'var(--color-dark, #2C1818)',
      marginBottom: '0.4rem',
    },
    progressTrack: {
      width: '100%',
      backgroundColor: 'var(--color-sandalwood, #EADDCA)',
      borderRadius: '9999px',
      height: '6px',
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: 'var(--color-maroon, #63131D)',
      borderRadius: '9999px',
      width: `${uploadProgress}%`,
      transition: 'width 0.15s ease',
    },
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
    },
    btnUpload: {
      flex: 2,
      padding: '0.7rem 1.25rem',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: 'var(--color-maroon, #63131D)',
      color: 'white',
      fontWeight: '600',
      fontSize: '0.95rem',
      cursor: (isUploading || !pid) ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      opacity: (isUploading || !pid) ? 0.6 : 1,
    },
    btnReset: {
      flex: 1,
      padding: '0.7rem 1.25rem',
      borderRadius: '8px',
      border: '1px solid var(--color-sandalwood, #EADDCA)',
      backgroundColor: 'white',
      color: 'var(--color-dark, #2C1818)',
      fontWeight: '600',
      fontSize: '0.95rem',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
    },
    outputSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    copyInputGroup: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      width: '100%',
      minWidth: 0,
    },
    readOnlyInput: {
      flex: 1,
      minWidth: 0,
      padding: '0.6rem 0.8rem',
      borderRadius: '8px',
      border: '1px solid var(--color-sandalwood, #EADDCA)',
      backgroundColor: '#FAF8F5',
      color: '#666',
      fontSize: '0.85rem',
      outline: 'none',
      boxSizing: 'border-box',
      cursor: 'default',
    },
    btnCopy: (isEnabled) => ({
      padding: '0.6rem 0.8rem',
      borderRadius: '8px',
      border: '1px solid var(--color-sandalwood, #EADDCA)',
      backgroundColor: isEnabled ? 'white' : '#F5F5F5',
      color: isEnabled ? 'var(--color-maroon, #63131D)' : '#999',
      fontWeight: '600',
      fontSize: '0.8rem',
      cursor: isEnabled ? 'pointer' : 'not-allowed',
      transition: 'all 0.2s',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: '0.35rem',
    }),
    alert: (type) => {
      const colors = {
        success: {
          bg: '#e8f5e9',
          border: '#c8e6c9',
          text: '#2e7d32',
        },
        error: {
          bg: '#ffebee',
          border: '#ffcdd2',
          text: '#c62828',
        },
        info: {
          bg: '#e3f2fd',
          border: '#bbdefb',
          text: '#1565c0',
        }
      };
      const activeColors = colors[type] || colors.info;
      return {
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        backgroundColor: activeColors.bg,
        border: `1px solid ${activeColors.border}`,
        color: activeColors.text,
        fontSize: '0.85rem',
        lineHeight: '1.4',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
      };
    },
    metaCard: {
      padding: '1rem',
      borderRadius: '12px',
      backgroundColor: '#FAF8F5',
      border: '1px solid var(--color-sandalwood, #EADDCA)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
    },
    metaHeader: {
      fontSize: '0.85rem',
      fontWeight: '700',
      color: 'var(--color-maroon, #63131D)',
      borderBottom: '1px solid var(--color-sandalwood, #EADDCA)',
      paddingBottom: '0.4rem',
      marginBottom: '0.15rem',
      display: 'flex',
      justifyContent: 'space-between',
    },
    metaRow: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '0.8rem',
    },
    metaLabel: {
      color: '#666',
      fontWeight: '500',
    },
    metaValue: {
      color: 'var(--color-dark, #2C1818)',
      fontWeight: '600',
    },
    spinner: {
      width: '16px',
      height: '16px',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '50%',
      borderTopColor: '#ffffff',
    }
  };

  // Check if configuration environment variables are loaded
  const isConfigured = !!(cloudName && uploadPreset);

  return (
    <div style={styles.container}>
      {/* Styles injector for custom CSS animations and element hovers */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes antigravity-spin-keyframe {
          to { transform: rotate(360deg); }
        }
        .antigravity-spinner-active {
          animation: antigravity-spin-keyframe 0.8s linear infinite;
        }
        .antigravity-btn-choice:hover {
          background-color: var(--color-sandalwood, #EADDCA) !important;
          border-color: var(--color-gold, #D4AF37) !important;
        }
        .antigravity-copy-btn-enabled:hover {
          background-color: #FAF4EE !important;
          color: var(--color-maroon, #63131D) !important;
          border-color: var(--color-maroon, #63131D) !important;
        }
        .antigravity-dropdown-item:hover {
          background-color: #FAF4EE !important;
          color: var(--color-maroon, #63131D) !important;
        }
        .antigravity-btn-danger:hover {
          background-color: rgba(239, 68, 68, 0.15) !important;
          border-color: rgba(239, 68, 68, 0.5) !important;
        }
        .antigravity-upload-btn-enabled:hover {
          background-color: #7d1825 !important;
        }
        .antigravity-reset-btn:hover {
          background-color: #FAF4EE !important;
          border-color: var(--color-maroon, #63131D) !important;
          color: var(--color-maroon, #63131D) !important;
        }
        .antigravity-missing-badge:hover {
          background-color: var(--color-maroon, #63131D) !important;
          border-color: var(--color-maroon, #63131D) !important;
          color: white !important;
        }
      `}} />

      {/* --- HEADER --- */}
      <header style={styles.header}>
        <h3 style={styles.title}>{uploadType === 'profile' ? 'Upload Profile Photo' : 'Upload Gallery Photo'}</h3>
        {!isConfigured && uploadService === 'cloudinary' && (
          <span style={{ 
            fontSize: '0.75rem', 
            color: '#c62828', 
            backgroundColor: '#ffebee', 
            border: '1px solid #ffcdd2',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontWeight: '600'
          }}>
            Missing Cloudinary Config
          </span>
        )}
      </header>

      {/* --- ROW LAYOUT --- */}
      <div style={styles.rowLayout}>
        
        {/* --- LEFT PANEL: Selection & Source image --- */}
        <div style={styles.leftPanel}>
          {/* Upload Destination Selector */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              💾 Upload Destination
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
              <button
                type="button"
                onClick={() => setUploadService('local')}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-sandalwood, #EADDCA)',
                  backgroundColor: uploadService === 'local' ? 'var(--color-maroon, #63131D)' : 'white',
                  color: uploadService === 'local' ? 'var(--color-gold, #D4AF37)' : 'var(--color-dark, #2C1818)',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🖥️ cPanel Server
              </button>
              <button
                type="button"
                onClick={() => setUploadService('cloudinary')}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-sandalwood, #EADDCA)',
                  backgroundColor: uploadService === 'cloudinary' ? 'var(--color-maroon, #63131D)' : 'white',
                  color: uploadService === 'cloudinary' ? 'var(--color-gold, #D4AF37)' : 'var(--color-dark, #2C1818)',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                ☁️ Cloudinary CDN
              </button>
            </div>
          </div>

          {/* Upload Purpose Selector */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              📁 Upload Purpose
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
              <button
                type="button"
                onClick={() => {
                  setUploadType('profile');
                  setPid('');
                  setUploadResult(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-sandalwood, #EADDCA)',
                  backgroundColor: uploadType === 'profile' ? 'var(--color-maroon, #63131D)' : 'white',
                  color: uploadType === 'profile' ? 'var(--color-gold, #D4AF37)' : 'var(--color-dark, #2C1818)',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                👤 Profile Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadType('gallery');
                  setPid('');
                  setUploadResult(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-sandalwood, #EADDCA)',
                  backgroundColor: uploadType === 'gallery' ? 'var(--color-maroon, #63131D)' : 'white',
                  color: uploadType === 'gallery' ? 'var(--color-gold, #D4AF37)' : 'var(--color-dark, #2C1818)',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🖼️ Gallery / Event Photo
              </button>
            </div>
          </div>

          {uploadType === 'profile' && (
            <>
              {/* Avatar Size Selector */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  📐 Photo Resolution (Clarity)
                </label>
                <select
                  value={avatarSize}
                  onChange={(e) => setAvatarSize(parseInt(e.target.value))}
                  style={styles.input}
                >
                  <option value={400}>Medium (400 x 400 px) - Standard</option>
                  <option value={600}>High (600 x 600 px) - Crisp HD (Recommended)</option>
                  <option value={800}>Super HD (800 x 800 px) - Maximum Sharpness</option>
                </select>
              </div>

              {/* Searchable Person Dropdown */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Select Person (Name)
            </label>
            
            {profiles.length > 0 ? (
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <div 
                  onClick={() => !isUploading && setDropdownOpen(!dropdownOpen)}
                  style={{
                    ...styles.input,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    borderColor: dropdownOpen ? 'var(--color-maroon, #63131D)' : 'var(--color-sandalwood, #EADDCA)',
                    boxShadow: dropdownOpen ? '0 0 0 3px rgba(99, 19, 29, 0.15)' : 'none',
                  }}
                >
                  <span style={{ color: selectedPersonData ? 'var(--color-dark, #2C1818)' : '#999', fontSize: '0.95rem' }}>
                    {selectedPersonData ? `${selectedPersonData.firstName} ${selectedPersonData.surName} (${selectedPersonData.pid})` : '-- Select Profile Name --'}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {dropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '105%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid var(--color-sandalwood, #EADDCA)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(99, 19, 29, 0.12)',
                    zIndex: 500,
                    padding: '0.6rem',
                    maxHeight: '260px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}>
                    <input
                      type="text"
                      placeholder="Type to search name or PID..."
                      value={peopleSearch}
                      onChange={(e) => setPeopleSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        ...styles.input,
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.9rem',
                        backgroundColor: '#FAF8F5',
                      }}
                      autoFocus
                    />
                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '2px' }}>
                      {filteredPeople.length > 0 ? (
                        filteredPeople.map(person => (
                          <div
                            key={person.pid}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPid(person.pid);
                              setDropdownOpen(false);
                              setPeopleSearch('');
                              setStatus(null);
                              setUploadResult(null);
                            }}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              backgroundColor: pid === person.pid ? '#FAF4EE' : 'transparent',
                              color: pid === person.pid ? 'var(--color-maroon, #63131D)' : 'var(--color-dark, #2C1818)',
                              transition: 'background-color 0.15s',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                            className="antigravity-dropdown-item"
                          >
                            <span style={{ fontWeight: pid === person.pid ? '600' : '400' }}>
                              {person.name} ({person.pid})
                            </span>
                            {person.photoUrl && (
                              <span style={{ 
                                fontSize: '0.7rem', 
                                backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                                color: '#2e7d32', 
                                padding: '0.1rem 0.35rem', 
                                borderRadius: '4px',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                              }}>
                                Photo OK
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '0.75rem', color: '#999', fontSize: '0.9rem', textAlign: 'center' }}>
                          No matches found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={pid}
                onChange={(e) => setPid(e.target.value)}
                onFocus={() => setActiveInput(true)}
                onBlur={() => setActiveInput(false)}
                placeholder="Enter ID (e.g. PID00001)"
                disabled={isUploading}
                style={styles.input}
              />
            )}
          </div>



          {/* --- EXISTING PHOTO DETECT & DELETE SECTION --- */}
          {pid && selectedPersonData && (
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#FAF8F5',
              border: '1px solid var(--color-sandalwood, #EADDCA)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-maroon, #63131D)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  {hasExistingPhoto ? '📸 Current Profile Photo' : 'ℹ️ Photo Status'}
                </span>
                {hasExistingPhoto && (
                  <button
                    type="button"
                    onClick={handleDeleteExistingPhoto}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(198, 40, 40, 0.08)',
                      border: '1px solid rgba(198, 40, 40, 0.25)',
                      color: '#c62828',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.2s',
                    }}
                    className="antigravity-btn-danger"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete Existing Photo
                  </button>
                )}
              </div>

              {hasExistingPhoto ? (
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  border: '1px solid var(--color-sandalwood, #EADDCA)'
                }}>
                  <img 
                    src={getBustedUrl(selectedPersonData.photoUrl)} 
                    alt="Existing avatar" 
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      border: '1px solid var(--color-sandalwood, #EADDCA)'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: '#555', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {selectedPersonData.photoUrl}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#888' }}>
                      A photo is assigned. Uploading a new file will replace it.
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>
                  No photo currently linked to this member's profile.
                </div>
              )}
            </div>
          )}
            </>
          )}

          {/* Choose Photo Dropzone / File Picker */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Select Image File
            </label>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png"
              style={{ display: 'none' }}
            />

            <div
              onClick={handleChoosePhotoClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={styles.dropzone}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-maroon, #63131D)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p style={styles.dropzoneTitle}>
                {selectedFile ? selectedFile.name : 'Drag & drop image here'}
              </p>
              <p style={styles.dropzoneSubtitle}>
                Supports JPG, JPEG, PNG (Max 2 MB)
              </p>
              <button 
                type="button" 
                disabled={isUploading}
                style={styles.btnChoose}
                className="antigravity-btn-choice"
              >
                Choose Photo
              </button>
            </div>

            {/* --- REMOTE URL OPTION --- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-dark, #2C1818)' }}>
                🔗 Or Paste Image URL
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Paste direct image URL (e.g. https://...)"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  disabled={isUploading}
                  style={{
                    ...styles.input,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    flex: 1
                  }}
                />
                <button
                  type="button"
                  onClick={handleLoadUrl}
                  disabled={isUploading}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-sandalwood, #EADDCA)',
                    backgroundColor: 'white',
                    color: 'var(--color-maroon, #63131D)',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  className="antigravity-copy-btn-enabled"
                >
                  Load
                </button>
              </div>
            </div>
          </div>

          {/* --- MISSING PHOTOS QUICK-LINK LIST --- */}
          {uploadType === 'profile' && missingPhotoProfiles.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              backgroundColor: '#FAF8F5',
              border: '1px dashed var(--color-sandalwood, #EADDCA)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginTop: '0.5rem',
            }}>
              <span style={{ 
                fontSize: '0.76rem', 
                fontWeight: '700', 
                color: 'var(--color-maroon, #63131D)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Profiles Missing Photos ({missingPhotoProfiles.length})
              </span>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.35rem', 
                maxHeight: '90px', 
                overflowY: 'auto',
                paddingRight: '4px' 
              }}>
                {missingPhotoProfiles.map(p => (
                  <button
                    key={p.pid}
                    type="button"
                    onClick={() => {
                      setPid(p.pid);
                      setDropdownOpen(false);
                      setPeopleSearch('');
                      setStatus(null);
                      setUploadResult(null);
                    }}
                    style={{
                      padding: '0.2rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      border: '1px solid var(--color-sandalwood, #EADDCA)',
                      color: 'var(--color-dark, #2C1818)',
                      fontSize: '0.72rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    className="antigravity-missing-badge"
                  >
                    {p.firstName} {p.surName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* --- RIGHT PANEL: Preview, Controls & Results --- */}
        <div style={styles.rightPanel}>
          {/* Image Preview / Crop Viewport Container */}
          <div style={styles.previewContainer}>
            {previewUrl ? (
              selectedFile ? (
                uploadType === 'profile' ? (
                  /* CROPPING MODE for local files */
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.8rem',
                    padding: '0.5rem 0',
                    width: '100%'
                  }}>
                    {/* Viewport Box */}
                    <div
                      onMouseDown={handleDragStart}
                      onMouseMove={handleDragMove}
                      onMouseUp={handleDragEnd}
                      onMouseLeave={handleDragEnd}
                      onTouchStart={handleDragStart}
                      onTouchMove={handleDragMove}
                      onTouchEnd={handleDragEnd}
                      style={{
                        width: '280px',
                        height: '280px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: isDraggingImage ? 'grabbing' : 'grab',
                        border: '2px solid var(--color-gold, #D4AF37)',
                        backgroundColor: '#FAF8F5',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt="Cropper Preview"
                        style={{
                          position: 'absolute',
                          userSelect: 'none',
                          pointerEvents: 'none',
                          maxWidth: 'none',
                          maxHeight: 'none',
                          ...getImageStyles()
                        }}
                      />
                      
                      {/* Avatar Circular Overlay */}
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        right: '10px',
                        bottom: '10px',
                        border: '2px dashed rgba(255, 255, 255, 0.8)',
                        borderRadius: '50%',
                        pointerEvents: 'none',
                        boxShadow: '0 0 0 999px rgba(99, 19, 29, 0.45)' // Translucent Maroon overlay
                      }} />
                    </div>

                    {/* Crop Controls */}
                    <div style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-dark, #2C1818)' }}>
                          🔍 Zoom & Position
                        </span>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setRotation((prev) => (prev + 90) % 360)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-maroon, #63131D)',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              padding: 0
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: 'scaleX(-1)' }}>
                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                            Rotate 90°
                          </button>
                          <span style={{ color: 'var(--color-sandalwood, #EADDCA)', fontSize: '0.75rem' }}>|</span>
                          <button
                            type="button"
                            onClick={handleResetCrop}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#666',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0
                            }}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setZoom(prev => Math.max(0.1, +(prev - 0.1).toFixed(2)))}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '0.2rem 0.4rem',
                            userSelect: 'none',
                            transition: 'transform 0.1s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Zoom Out"
                        >
                          ➖
                        </button>
                        <input
                          type="range"
                          min="0.1"
                          max="4"
                          step="0.05"
                          value={zoom}
                          onChange={(e) => setZoom(parseFloat(e.target.value))}
                          style={{
                            flex: 1,
                            cursor: 'pointer',
                            accentColor: 'var(--color-maroon, #63131D)',
                            height: '5px',
                            borderRadius: '5px',
                            backgroundColor: 'var(--color-sandalwood, #EADDCA)'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setZoom(prev => Math.min(4, +(prev + 0.1).toFixed(2)))}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '0.2rem 0.4rem',
                            userSelect: 'none',
                            transition: 'transform 0.1s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Zoom In"
                        >
                          ➕
                        </button>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: '#777', textAlign: 'center', marginTop: '0.1rem' }}>
                        🖱️ Drag image to pan | Slider to zoom
                      </span>
                    </div>
                  </div>
                ) : (
                  /* FULL SIZE VIEW MODE for gallery photo */
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.8rem',
                    padding: '0.5rem 0',
                    width: '100%'
                  }}>
                    <div style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid var(--color-sandalwood, #EADDCA)',
                      backgroundColor: '#FAF8F5',
                      width: '100%',
                      maxHeight: '340px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <img
                        src={previewUrl}
                        alt="Gallery Preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '340px',
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#777', textAlign: 'center' }}>
                      🖼️ General Photo Preview (No cropping applied)
                    </span>
                  </div>
                )
              ) : (
                /* STATIC VIEW MODE for existing database URL */
                <img
                  src={getBustedUrl(previewUrl)}
                  alt="Upload Preview"
                  style={styles.previewImage}
                />
              )
            ) : (
              <div style={styles.emptyPreview}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="21" y1="21" x2="9" y2="9" />
                  <line x1="9" y1="15" x2="15" y2="9" />
                </svg>
                <span>No image preview available</span>
              </div>
            )}
          </div>

          {/* --- UPLOAD PROGRESS --- */}
          {(isUploading || uploadProgress > 0) && (
            <div style={styles.progressArea}>
              <div style={styles.progressHeader}>
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={styles.progressTrack}>
                <div style={styles.progressBar} />
              </div>
            </div>
          )}

          {/* --- ACTION BUTTONS --- */}
          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || !selectedFile || (uploadType === 'profile' && !pid)}
              onMouseEnter={() => setIsHoveredUpload(true)}
              onMouseLeave={() => setIsHoveredUpload(false)}
              style={{
                ...styles.btnUpload,
                ...((isUploading || !selectedFile || (uploadType === 'profile' && !pid)) ? {} : { cursor: 'pointer' })
              }}
              className={(!isUploading && selectedFile && (uploadType === 'gallery' || pid)) ? "antigravity-upload-btn-enabled" : ""}
            >
              {isUploading ? (
                <>
                  <span style={styles.spinner} className="antigravity-spinner-active" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 16 12 12 8 16" />
                    <line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                  </svg>
                  Upload
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              onMouseEnter={() => setIsHoveredReset(true)}
              onMouseLeave={() => setIsHoveredReset(false)}
              style={styles.btnReset}
              className="antigravity-reset-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset
            </button>
          </div>

          {/* --- OUTPUT SECTION --- */}
          <div style={styles.outputSection}>
            {/* Cloudinary URL textbox */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Cloudinary Secure URL</label>
              <div style={styles.copyInputGroup}>
                <input
                  type="text"
                  readOnly
                  placeholder="URL will appear here after upload"
                  value={uploadResult ? uploadResult.secureUrl : ''}
                  style={styles.readOnlyInput}
                />
                <button
                  type="button"
                  disabled={!uploadResult}
                  onClick={() => copyToClipboard(uploadResult?.secureUrl, 'Cloudinary URL')}
                  style={styles.btnCopy(!!uploadResult)}
                  className={uploadResult ? "antigravity-copy-btn-enabled" : ""}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy URL
                </button>
              </div>
            </div>

            {/* Public ID textbox */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Public ID</label>
              <div style={styles.copyInputGroup}>
                <input
                  type="text"
                  readOnly
                  placeholder="Public ID will appear here after upload"
                  value={uploadResult ? uploadResult.publicId : ''}
                  style={styles.readOnlyInput}
                />
                <button
                  type="button"
                  disabled={!uploadResult}
                  onClick={() => copyToClipboard(uploadResult?.publicId, 'Public ID')}
                  style={styles.btnCopy(!!uploadResult)}
                  className={uploadResult ? "antigravity-copy-btn-enabled" : ""}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy ID
                </button>
              </div>
            </div>
          </div>

          {/* --- STATUS MESSAGE --- */}
          {status && (
            <div style={styles.alert(status.type)}>
              <div style={{ marginTop: '2px' }}>
                {status.type === 'success' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : status.type === 'error' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c62828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </div>
              <span style={{ wordBreak: 'break-word' }}>{status.text}</span>
            </div>
          )}

          {/* --- METADATA SECTION ON SUCCESS --- */}
          {uploadResult && (
            <div style={styles.metaCard}>
              <div style={styles.metaHeader}>
                <span>Upload Metadata</span>
                <span style={{ color: 'var(--color-maroon, #63131D)' }}>Success</span>
              </div>
              
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Upload Time:</span>
                <span style={styles.metaValue}>{uploadResult.uploadTime}</span>
              </div>

              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Dimensions:</span>
                <span style={styles.metaValue}>{uploadResult.width} × {uploadResult.height} px</span>
              </div>

              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>File Size:</span>
                <span style={styles.metaValue}>{uploadResult.fileSize}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CloudinaryUpload;
