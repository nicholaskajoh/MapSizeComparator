let currentSearchResultsData = [];

// search for places
const searchButton = document.getElementById('searchButton');
const searchLoading = document.getElementById('searchLoading');
searchButton.addEventListener('click', function() {
  const searchBox = document.getElementById('searchBox');
  const query = searchBox.value.trim();
  if (query != '') {
    searchLoading.hidden = false;
    fetch(`https://nominatim.openstreetmap.org/search.php?polygon_geojson=1&format=json&q='${query}`)
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        currentSearchResultsData = data.filter(function(_map) { return _map.geojson.type == 'Polygon'; });
        // display search results
        const searchResults = document.getElementById('searchResults');
        const searchResultsHtml = currentSearchResultsData.length > 0 
          ? currentSearchResultsData.reduce(function(html, _map, i) {
              return html + ` <button
                                class="addMap"
                                data-place-index="${i}">
                                  Add: ${_map.display_name} (${_map.type})
                              </button>`;
            }, 'Search results:')
          : `No results found for "${query}"`;
        searchResults.innerHTML = searchResultsHtml;
        searchLoading.hidden = true;
      })
      .catch(function(err) {
        alert(err);
        searchLoading.hidden = true;
      });
  }
});

function getBoundingBox(coordsSet) {
  let [minLon , minLat , maxLon , maxLat] = [...coordsSet[0], ...coordsSet[0]]; // initialize
  
  coordsSet.forEach(function(coords) {
    minLon = coords[0] < minLon ? coords[0] : minLon;
    minLat = coords[1] < minLat ? coords[1] : minLat;
    maxLon = coords[0] > maxLon ? coords[0] : maxLon;
    maxLat = coords[1] > maxLat ? coords[1] : maxLat;
  });
  
  return [minLon , minLat , maxLon , maxLat];
}

let maps = [];
const mapBoundingBoxes = {};
const mapColors = {};

function updateMapsList() {
  document.getElementById('mapsList').innerHTML = maps.reduce(function(html, _map, i) {
    return html + ` <button
                      class="removeMap"
                      data-place-index="${i}"
                      style="color: ${mapColors[_map.place_id]};">
                        Remove: ${_map.display_name} (${_map.type})
                    </button>`;
  }, '');
}

document.addEventListener('click', function (e) {
  function hasClass(element, className) {
    return element.className.split(' ').indexOf(className) > -1;
  }
  // add a place's map
  if (hasClass(e.target, 'addMap')) {
    const _map = currentSearchResultsData[e.target.getAttribute('data-place-index')];
    if (!mapBoundingBoxes.hasOwnProperty(_map.place_id)) {
      mapBoundingBoxes[_map.place_id] = getBoundingBox(_map.geojson.coordinates[0]);
    }
    maps.push(_map);
    render();
    updateMapsList();
  }

  // remove a place's map
  if (hasClass(e.target, 'removeMap')) {
    delete mapBoundingBoxes[maps[e.target.getAttribute('data-place-index')].place_id];
    maps.splice(e.target.getAttribute('data-place-index'), 1);
    render();
    updateMapsList();
  }
}, false);

function boundingBoxArea(bbox) {
  const [xMin , yMin , xMax , yMax] = bbox;
  const w = Math.abs(xMax - xMin);
  const h = Math.abs(yMax - yMin);
  return w * h;
}

function maxBoundingBox() {
  let maxBox = mapBoundingBoxes[maps[0].place_id]; // initialize
  for (let placeId in mapBoundingBoxes) {
    const maxBoxArea = boundingBoxArea(maxBox);
    const currentBoxArea = boundingBoxArea(mapBoundingBoxes[placeId]);
    if (mapBoundingBoxes.hasOwnProperty(placeId) && currentBoxArea > maxBoxArea) {
      maxBox = mapBoundingBoxes[placeId];
    }
  }
  return maxBox;
}

function randomColorHex() {
  let red = Math.floor((Math.random() * 256));
  let green = Math.floor((Math.random() * 256));
  let blue = Math.floor((Math.random() * 256));
  red = (red + 80) / 2;
  green = (green + 80) / 2;
  blue = (blue + 80) / 2;

  return `rgb(${Math.floor(red)}, ${Math.floor(green)}, ${Math.floor(blue)})`;
}

function shiftCoordTowardsCenter(coord, mapCenterCoord, CanvasCenterCoord) {
  // shift map to center of canvas by moving x/y coordinate
  return coord + (CanvasCenterCoord - mapCenterCoord);
}

function draw(options) {
  const { coordsSet, placeId, maxBoundingBox, scale } = options;

  const [minLon , minLat , maxLon , maxLat] = maxBoundingBox;
  coordsSet.map(function(coords, i) {
    let longitude = coords[0];
    let latitude = coords[1];
    // translate lon/lat to max bounding box center point
    const [mapMinLon, mapMinLat, mapMaxLon, mapMaxLat] = mapBoundingBoxes[placeId];
    const [xMapCenter, yMapCenter] = [
      mapMinLon + (Math.abs(mapMaxLon - mapMinLon) / 2),
      mapMinLat + (Math.abs(mapMaxLat - mapMinLat) / 2),
    ];
    const [xCenter, yCenter] = [
      minLon + (Math.abs(maxLon - minLon) / 2),
      minLat + (Math.abs(maxLat - minLat) / 2),
    ];
    const [xTranslate, yTranslate] = [xCenter - xMapCenter, yCenter - yMapCenter];
    longitude += xTranslate;
    latitude += yTranslate;
    // scale lon/lat to get x-y coordinates to be plotted on canvas
    point = {
      x: Math.abs(longitude - minLon) * scale,
      y: Math.abs(maxLat - latitude) * scale,
    };
    const mapCenterY = Math.abs(maxLat - minLat) * scale / 2;
    const canvasCenterY = mapHeight / 2;
    point.y = shiftCoordTowardsCenter(point.y, mapCenterY, canvasCenterY);

    // console.log(point);
    if (i === 0) {
      context.beginPath();
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  });
}

const canvas = document.getElementById('map');
const context = canvas.getContext('2d');
const mapWidth = canvas.width;
const mapHeight = canvas.height;

function render() {
  context.clearRect(0, 0, mapWidth, mapHeight);

  if (maps.length > 0) {
    const renderLoading = document.getElementById('renderLoading');
    renderLoading.hidden = false;

    const [minLon , minLat , maxLon , maxLat] = maxBoundingBox();
    const xScale = mapWidth / Math.abs(maxLon - minLon);
    const yScale = mapHeight / Math.abs(maxLat - minLat);
    const scale = xScale < yScale ? xScale : yScale;

    maps.map(function(_map) {
      if (!mapColors.hasOwnProperty(_map.place_id)) mapColors[_map.place_id] = randomColorHex();
      context.strokeStyle = mapColors[_map.place_id];

      const fullCoordsSet = _map.geojson.coordinates[0];
      let cursorStart = 0;
      let cursorEnd = 50; // draw 50 points per time
      draw({
        coordsSet: fullCoordsSet.slice(cursorStart, cursorEnd),
        placeId: _map.place_id,
        maxBoundingBox: [minLon , minLat , maxLon , maxLat],
        scale,
      });
      while (cursorEnd < fullCoordsSet.length) {
        cursorStart = cursorEnd - 1; // -1 prevents gaps in map
        cursorEnd += 50;
        draw({
          coordsSet: fullCoordsSet.slice(cursorStart, cursorEnd),
          placeId: _map.place_id,
          maxBoundingBox: [minLon , minLat , maxLon , maxLat],
          scale,
        });
      }
    });

    renderLoading.hidden = true;
  }
}