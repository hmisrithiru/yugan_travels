document.addEventListener('DOMContentLoaded', () => {
    const tripTypeSelect = document.getElementById('tripType');
    const carTypeSelect = document.getElementById('carType');
    
    const locationFields = document.getElementById('locationFields');
    const pickupInput = document.getElementById('pickup');
    const dropInput = document.getElementById('drop');

    const distanceGroup = document.getElementById('distanceGroup');
    const distanceInput = document.getElementById('distance');
    const distanceLabel = document.getElementById('distanceLabel');
    
    const hoursGroup = document.getElementById('hoursGroup');
    const hoursInput = document.getElementById('hours');
    
    const daysGroup = document.getElementById('daysGroup');
    const daysInput = document.getElementById('days');

    const calculateBtn = document.getElementById('calculateBtn');
    const calcText = document.getElementById('calcText');
    const calcSpinner = document.getElementById('calcSpinner');
    
    const submitBookingBtn = document.getElementById('submitBookingBtn');
    const totalPriceEl = document.getElementById('totalPrice');
    const summaryDetails = document.getElementById('summaryDetails');
    const successMessage = document.getElementById('successMessage');
    
    const mapContainer = document.getElementById('mapContainer');

    let calculatedPrice = 0;
    let summaryHTML = '';
    
    // Map variables
    let map = null;
    let mapRouteLayer = null;
    let pickupMarker = null;
    let dropMarker = null;

    // Toggle fields based on trip type
    tripTypeSelect.addEventListener('change', () => {
        const type = tripTypeSelect.value;
        
        distanceGroup.style.display = 'none';
        hoursGroup.style.display = 'none';
        daysGroup.style.display = 'none';
        locationFields.style.display = 'none';
        mapContainer.style.display = 'none';
        
        if (type === 'oneway' || type === 'roundtrip') {
            distanceGroup.style.display = 'block';
            locationFields.style.display = 'flex';
            distanceLabel.textContent = 'Calculated Distance (km)';
        } else if (type === 'package') {
            hoursGroup.style.display = 'block';
            distanceGroup.style.display = 'block';
            locationFields.style.display = 'flex';
            distanceLabel.textContent = 'Calculated Distance (km)';
        } else if (type === 'dayrent') {
            daysGroup.style.display = 'block';
        }
        
        resetBooking();
    });
    
    // Trigger initial state
    tripTypeSelect.dispatchEvent(new Event('change'));
    
    carTypeSelect.addEventListener('change', resetBooking);
    pickupInput.addEventListener('input', resetBooking);
    dropInput.addEventListener('input', resetBooking);
    distanceInput.addEventListener('input', resetBooking);
    hoursInput.addEventListener('input', resetBooking);
    daysInput.addEventListener('input', resetBooking);

    function resetBooking() {
        submitBookingBtn.disabled = true;
        totalPriceEl.textContent = '₹ 0';
        summaryDetails.innerHTML = '<p class="placeholder-text">Click Calculate to update the price estimate.</p>';
        successMessage.style.display = 'none';
    }

    // Initialize Map if not already initialized
    function initMap() {
        if (!map) {
            mapContainer.style.display = 'block';
            // Default center around Tamil Nadu
            map = L.map('routeMap').setView([10.8505, 76.2711], 7);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
        }
        mapContainer.style.display = 'block';
        // Need to invalidate size after unhiding so map renders fully
        setTimeout(() => map.invalidateSize(), 100);
    }

    async function getCoordinates(placeName) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            }
        } catch (e) {
            console.error('Geocoding error:', e);
        }
        return null;
    }

    async function getRoute(coord1, coord2) {
        try {
            // Request route geometry as geojson
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coord1.lon},${coord1.lat};${coord2.lon},${coord2.lat}?overview=full&geometries=geojson`);
            const data = await res.json();
            if (data && data.code === 'Ok' && data.routes.length > 0) {
                return {
                    distanceKm: data.routes[0].distance / 1000,
                    durationHr: data.routes[0].duration / 3600,
                    geometry: data.routes[0].geometry
                };
            }
        } catch (e) {
            console.error('Routing error:', e);
        }
        return null;
    }

    // Calculate Logic
    calculateBtn.addEventListener('click', async () => {
        const type = tripTypeSelect.value;
        const car = carTypeSelect.value;
        
        let distance = parseFloat(distanceInput.value) || 0;
        let hours = parseFloat(hoursInput.value) || 0;
        const days = parseFloat(daysInput.value) || 0;
        
        let pickupPlace = pickupInput.value.trim();
        let dropPlace = dropInput.value.trim();
        
        // Auto-calculate distance if locations provided
        if ((type === 'oneway' || type === 'roundtrip' || type === 'package') && pickupPlace && dropPlace) {
            calculateBtn.disabled = true;
            calcText.textContent = 'Calculating Route...';
            calcSpinner.style.display = 'inline-block';
            
            const p1 = await getCoordinates(pickupPlace);
            const p2 = await getCoordinates(dropPlace);
            
            if (p1 && p2) {
                const route = await getRoute(p1, p2);
                if (route) {
                    distance = route.distanceKm;
                    if (type === 'roundtrip') {
                        distance = distance * 2; // Double for roundtrip
                    }
                    distanceInput.value = distance.toFixed(1);
                    
                    if (type === 'package') {
                        hours = route.durationHr + 2; 
                        hoursInput.value = hours.toFixed(1);
                    }
                    
                    // Show map and draw route
                    initMap();
                    
                    if (pickupMarker) map.removeLayer(pickupMarker);
                    if (dropMarker) map.removeLayer(dropMarker);
                    if (mapRouteLayer) map.removeLayer(mapRouteLayer);
                    
                    pickupMarker = L.marker([p1.lat, p1.lon]).addTo(map).bindPopup("Pickup: " + pickupPlace);
                    dropMarker = L.marker([p2.lat, p2.lon]).addTo(map).bindPopup("Drop: " + dropPlace);
                    
                    mapRouteLayer = L.geoJSON(route.geometry, {
                        style: { color: '#88C343', weight: 4, opacity: 0.8 }
                    }).addTo(map);
                    
                    // Zoom map to fit route bounds
                    map.fitBounds(mapRouteLayer.getBounds(), { padding: [50, 50] });

                } else {
                    alert('Could not calculate route between these locations. Using manual inputs if provided.');
                }
            } else {
                alert('Could not find one of the locations on the map. Using manual inputs if provided.');
            }
            
            calculateBtn.disabled = false;
            calcText.textContent = 'Calculate Distance & Price';
            calcSpinner.style.display = 'none';
        }

        // If distance/hours are still 0 after attempting calculation, abort unless dayrent
        if (type !== 'dayrent' && (distance <= 0)) {
            alert('Please enter valid pickup/drop locations or manual distance.');
            return;
        }

        let price = 0;
        let details = '';
        let locationHTML = (pickupPlace || dropPlace) ? `<p><strong>Route:</strong> ${pickupPlace || 'N/A'} to ${dropPlace || 'N/A'}</p>` : '';

        if (type === 'oneway') {
            const ratePerKm = (car === '4+1') ? 15 : 21;
            const driverFee = 500;
            price = (distance * ratePerKm) + driverFee;
            details = `
                <p><strong>Trip:</strong> One Way</p>
                <p><strong>Car:</strong> ${car} Seater</p>
                ${locationHTML}
                <p><strong>Distance:</strong> ${distance.toFixed(1)} km @ ₹${ratePerKm}/km</p>
                <p><strong>Driver Fee:</strong> ₹${driverFee}</p>
            `;
        } else if (type === 'roundtrip') {
            const ratePerKm = (car === '4+1') ? 14 : 20;
            const driverFee = 500;
            const oneWayDist = (distance / 2).toFixed(1);
            price = (distance * ratePerKm) + driverFee;
            details = `
                <p><strong>Trip:</strong> Round Trip</p>
                <p><strong>Car:</strong> ${car} Seater</p>
                ${locationHTML}
                <p><strong>Distance Calc:</strong> ${oneWayDist} km (To Drop) + ${oneWayDist} km (Return) = <strong>${distance.toFixed(1)} km Total</strong></p>
                <p><strong>Total Distance Cost:</strong> ${distance.toFixed(1)} km @ ₹${ratePerKm}/km</p>
                <p><strong>Driver Fee:</strong> ₹${driverFee}</p>
            `;
        } else if (type === 'package') {
            const ratePerHr = (car === '4+1') ? 300 : 5050;
            const baseKm = hours * 10;
            const extraKmRate = (car === '4+1') ? 25 : 35;
            
            const basePrice = Math.ceil(hours) * ratePerHr;
            let extraPrice = 0;
            let extraKmStr = '0';
            
            if (distance > baseKm) {
                const extraKm = distance - baseKm;
                extraPrice = extraKm * extraKmRate;
                extraKmStr = `${extraKm.toFixed(1)} km @ ₹${extraKmRate}/km`;
            }
            
            price = basePrice + extraPrice;
            details = `
                <p><strong>Trip:</strong> Package Plan</p>
                <p><strong>Car:</strong> ${car} Seater</p>
                ${locationHTML}
                <p><strong>Package Rate:</strong> ${hours.toFixed(1)} hrs @ ₹${ratePerHr.toLocaleString('en-IN')}/hr</p>
                <p><strong>Included Distance:</strong> ${baseKm.toFixed(1)} km</p>
                <p><strong>Extra Distance Charge:</strong> ${extraKmStr} (₹${extraPrice.toFixed(0)})</p>
            `;
        } else if (type === 'dayrent') {
            const ratePerDay = (car === '4+1') ? 4000 : 5500;
            price = days * ratePerDay;
            details = `
                <p><strong>Trip:</strong> Day Rent</p>
                <p><strong>Car:</strong> ${car} Seater</p>
                <p><strong>Days:</strong> ${days} (12hr, 250km per day)</p>
                <p><strong>Rate:</strong> ₹${ratePerDay}/day</p>
            `;
        }
        
        calculatedPrice = Math.round(price);
        summaryHTML = details;
        
        totalPriceEl.textContent = `₹ ${calculatedPrice.toLocaleString('en-IN')}`;
        summaryDetails.innerHTML = details;
        submitBookingBtn.disabled = false;
    });

    // Handle Form Submit
    submitBookingBtn.addEventListener('click', () => {
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;
        
        let pickupPlace = pickupInput ? pickupInput.value.trim() : '';
        let dropPlace = dropInput ? dropInput.value.trim() : '';
        
        if (!name || !phone || !email) {
            alert('Please fill in your name, phone number, and email.');
            return;
        }

        const booking = {
            id: Date.now().toString(),
            date: new Date().toLocaleString(),
            name: name,
            phone: phone,
            email: email,
            car: carTypeSelect.value,
            trip: tripTypeSelect.value,
            pickup: pickupPlace,
            drop: dropPlace,
            price: calculatedPrice,
            details: summaryHTML
        };

        // Save to LocalStorage
        let bookings = JSON.parse(localStorage.getItem('yuganBookings')) || [];
        bookings.push(booking);
        localStorage.setItem('yuganBookings', JSON.stringify(bookings));

        // Show Success
        submitBookingBtn.style.display = 'none';
        successMessage.style.display = 'block';
    });
});
