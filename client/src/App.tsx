import React, { useState, useEffect } from 'react';
import './App.css';
import QRCode from 'qrcode';

const API_BASE_URL = 'https://copy-innovate.onrender.com';

// Function to generate and download donor card PNG
const generateAndDownloadDonorCard = async (qrData: any, donorId: string, mobileNumber: string) => {
  try {
    const qrText = `DONOR_ID: ${donorId}\nMobile: ${mobileNumber}\nRequest: ${qrData.requestId || qrData.requestId}`;
    const qrCodeDataURL = await QRCode.toDataURL(qrText, { width: 220, margin: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 450; canvas.height = 650;

    // Background
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#007bff'; ctx.lineWidth = 15; ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);

    // Header
    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
    ctx.fillText('BLOOD REQUEST RESPONSE', canvas.width / 2, 80);

    // Donor ID Section
    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 22px Arial';
    ctx.fillText('DONOR ID', canvas.width / 2, 130);
    ctx.fillStyle = '#007bff'; ctx.font = 'bold 38px Arial';
    ctx.fillText(donorId, canvas.width / 2, 180);

    // Details
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2c3e50'; ctx.font = '20px Arial';
    ctx.fillText(`Mobile:  ${mobileNumber}`, 50, 240);
    ctx.fillText(`Request ID:  ${qrData.requestId || 'N/A'}`, 50, 290);

    // QR Code Label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#007bff'; ctx.font = 'bold 24px Arial';
    ctx.fillText('SCAN QR CODE', canvas.width / 2, 360);

    const qrImage = new Image();
    qrImage.onload = () => {
      // Draw QR Code frame
      ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 2;
      ctx.strokeRect((canvas.width - 240) / 2, 380, 240, 240);

      // Draw QR Code
      ctx.drawImage(qrImage, (canvas.width - 220) / 2, 390, 220, 220);

      const link = document.createElement('a');
      link.download = `donor-card-${donorId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImage.src = qrCodeDataURL;
  } catch (err) { console.error('Card gen error:', err); }
};

function App() {
  const [result, setResult] = useState('');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number, lng: number, acc: number } | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [locationStatus, setLocationStatus] = useState<'getting' | 'success' | 'error' | 'denied'>('getting');
  const [requestStatus, setRequestStatus] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(true);

  // Extract requestId and token from URL (Path or Query)
  const urlPath = window.location.pathname;
  const pathParts = urlPath.split('/').filter(Boolean);
  const pathId = pathParts[pathParts.length - 1];

  const urlParams = new URLSearchParams(window.location.search);
  const queryToken = urlParams.get('token');
  const queryRequestId = urlParams.get('requestId');

  // Logic: 
  // 1. If pathId is a full 24-char MongoDB ID, it's the requestId.
  // 2. Otherwise, check query parameters.
  // 3. Any 8-char short string is treated as a token.
  const requestId = queryRequestId || (pathId?.length === 24 ? pathId : null);
  const token = queryToken || (pathId?.length !== 24 ? pathId : null);

  const rawId = requestId || token; // Value to send for validation
  const finalToken = token;

  // Validate request on mount
  useEffect(() => {
    const validateRequest = async () => {
      try {
        setIsValidating(true);
        const res = await fetch(`${API_BASE_URL}/api/bloodrequest/${rawId}`, {
          cache: 'no-store'
        });
        const data = await res.json();
        setRequestStatus(data);
      } catch (err) {
        console.error('Validation error:', err);
        setResult('Error validating request. Please try again later.');
      } finally {
        setIsValidating(false);
      }
    };

    if (rawId) {
      validateRequest();
    }
  }, [rawId]);

  // Auto-fetch location when component mounts
  useEffect(() => {
    if (requestStatus?.status === 'active') {
      getCurrentLocation();
    }
  }, [requestStatus]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setResult("Geolocation not supported.");
      setLocationStatus('error');
      return;
    }

    setResult("Getting your location...");
    setLocationStatus('getting');

    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy
        };

        if (coords.acc <= 50) {
          setCurrentCoords(coords);
          setLocationStatus('success');
          setResult(`
            <p>Location captured successfully!</p>
            <p>Accuracy: ±${coords.acc.toFixed(2)} meters</p>
          `);
        } else {
          setResult("Improving location accuracy...");
          const watchId = navigator.geolocation.watchPosition(
            pos2 => {
              const coords2 = {
                lat: pos2.coords.latitude,
                lng: pos2.coords.longitude,
                acc: pos2.coords.accuracy
              };
              const bestCoords = coords2.acc < coords.acc ? coords2 : coords;
              navigator.geolocation.clearWatch(watchId);
              setCurrentCoords(bestCoords);
              setLocationStatus('success');
              setResult(`
                <p>Location captured successfully!</p>
                <p>Accuracy: ±${bestCoords.acc.toFixed(2)} meters</p>
              `);
            },
            err => {
              navigator.geolocation.clearWatch(watchId);
              setCurrentCoords(coords);
              setLocationStatus('success');
              setResult(`
                <p>Location captured!</p>
              `);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        }
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setResult(`Location access denied. Please enable location services and refresh the page.`);
        } else {
          setLocationStatus('error');
          setResult(`Error getting location: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const formatMobileNumber = (mobile: string): string => {
    let cleaned = mobile.trim().replace(/[\s-]/g, '');
    if (cleaned.startsWith('+91')) return cleaned;
    if (cleaned.startsWith('91') && cleaned.length > 10) return '+' + cleaned;
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    return '+91' + cleaned;
  };

  const saveCurrentLocation = async () => {
    if (!currentCoords) {
      setResult('Location not captured yet. Please wait or refresh.');
      return;
    }

    const cleaned = mobileNumber.trim().replace(/\D/g, ''); // Extract only digits
    const isTenDigits = cleaned.length === 10;

    if (!isTenDigits) {
      setResult('Please enter a valid 10-digit mobile number.');
      return;
    }

    setResult("Submitting your response...");

    const formattedMobile = formatMobileNumber(mobileNumber);

    try {
      const requestBody = {
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        accuracy: currentCoords.acc,
        mobileNumber: formattedMobile,
        token: finalToken,
        requestId: requestStatus?.data?.requestId || rawId
      };

      const res = await fetch(`${API_BASE_URL}/api/save-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        cache: 'no-store'
      });
      const data = await res.json();

      if (data.status === 'closed') {
        setRequestStatus(data);
        setResult(data.message);
        return;
      }

      if (data.error) {
        setResult(data.error);
      } else {
        const qrData = data.qrData || { requestId: requestStatus?.data?.requestId || rawId, token: finalToken };
        await generateAndDownloadDonorCard(qrData, data.donorId, formattedMobile);

        setResult(`
          <p>Response submitted successfully!</p>
          <p><strong>Donor ID:</strong> ${data.donorId}</p>
          <p>Your donor card has been downloaded.</p>
        `);

        // Redirect to Google Maps
        const HOSPITAL_LAT = 22.6023;
        const HOSPITAL_LNG = 72.8205;
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${currentCoords.lat},${currentCoords.lng}&destination=${HOSPITAL_LAT},${HOSPITAL_LNG}&travelmode=driving`;

        setTimeout(() => {
          window.open(mapsUrl, '_blank');
        }, 3000);
      }
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    }
  };

  if (isValidating) {
    return (
      <div className="App">
        <div className="app-container">
          <div className="card">
            <h3>Validating Blood Request...</h3>
            <p>Please wait a moment.</p>
          </div>
        </div>
      </div>
    );
  }

  if (requestStatus?.status === 'closed') {
    return (
      <div className="App">
        <div className="app-container">
          <h1 className="app-title">Donor Tracker</h1>
          <div className="card status-denied">
            <h2 style={{ color: '#dc3545' }}>Request Closed</h2>
            <p>{requestStatus.message}</p>
            {requestStatus.data && (
              <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                <p>Blood Group: <strong>{requestStatus.data.bloodGroup}</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="app-container">
        <h1 className="app-title">Donor Tracker</h1>

        {requestStatus?.data && (
          <div className="card blood-request-card">
            <h3 className="blood-request-title">Active Blood Request</h3>
            <div className="request-info-grid">
              <p>Requested Group: <span className="badge">{requestStatus.data.bloodGroup}</span></p>
              <p>Status: <span className="status-badge">Active</span></p>
            </div>
          </div>
        )}

        {locationStatus === 'denied' && (
          <div className="card status-denied">
            <h3>Location Access Required</h3>
            <p>Please enable location services to respond.</p>
            <button className="refresh-button" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {locationStatus === 'success' && (
          <div className="card form-card">
            <h3 className="form-title">Submit Your Location</h3>
            <input
              className="input-field"
              type="tel"
              maxLength={10}
              placeholder="Enter 10-Digit Mobile Number"
              value={mobileNumber}
              onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))}
            />
            <button
              className="submit-button"
              onClick={saveCurrentLocation}
              disabled={!mobileNumber.trim() || !!result.includes('submitted')}
            >
              Confirm & Submit
            </button>
          </div>
        )}

        {result && (
          <div className="card result-card">
            <div dangerouslySetInnerHTML={{ __html: result }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
