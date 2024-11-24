var niobrara = ee.Geometry.Polygon(
    [[[-98.06421323506802, 42.77877650909099],
      [-98.06421323506802, 42.73567079040325],
      [-98.01717801778287, 42.73567079040325],
      [-98.01717801778287, 42.77877650909099]]], null, false);

var image = imageCollection
              .filterBounds(niobrara)
              .filter(ee.Filter.date('2009-01-01', '2024-06-30'))
              .map(function(image) {
                          return image.clip(niobrara);
                        });

print(image.size());

Map.addLayer(image);

var calculateNDWI = function(image) {
  var NIR = image.select('N');
  var Green = image.select('G');
  var NDWI = Green.subtract(NIR).divide(Green.add(NIR)).rename('NDWI');
  return image.addBands(NDWI);
};

var imageWithNDWI = image.map(calculateNDWI);

var ndwiCollection = imageWithNDWI.select('NDWI');

// Group images by year and calculate median NDWI for each year
var years = ee.List.sequence(2009, 2024);
var yearlyNDWI = ee.ImageCollection.fromImages(
  years.map(function(year) {
    var yearlyCollection = ndwiCollection.filter(ee.Filter.calendarRange(year, year, 'year'));
    var medianImage = yearlyCollection.reduce(ee.Reducer.median()).set('year', year);
    return medianImage;
  })
);

// Visualize the NDWI image for a specific year (e.g., 2010)
var ndwiVisParams = {min: -1, max: 1, palette: ['green', 'white', 'blue']};
var ndwi2010 = yearlyNDWI.filter(ee.Filter.eq('year', 2010)).first();
Map.addLayer(ndwi2010, ndwiVisParams, 'NDWI 2010');

// Print the yearly NDWI collection to inspect
print(yearlyNDWI);

// Function to export each image in the collection
var exportNDWIImage = function(image) {
  var year = ee.Number(image.get('year')).getInfo(); // Correctly get the year property
  Export.image.toDrive({
    image: image,
    description: 'NDWI_' + year,
    scale: 30, // resolution in meters, change as needed
    region: niobrara, // specify the region of interest
    folder: 'Yearly_NDWI_nio',
    maxPixels: 1e13
  });
};

// Export each image in the yearly NDWI collection
yearlyNDWI.toList(yearlyNDWI.size()).evaluate(function(yearlyNDWIList) {
  yearlyNDWIList.forEach(function(imageInfo) {
    var image = ee.Image(imageInfo.id);
    image = image.set('year', imageInfo.properties.year); // Ensure year is set
    exportNDWIImage(image);
  });
});
