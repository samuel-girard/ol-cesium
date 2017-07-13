const ol2d = new ol.Map({
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  controls: ol.control.defaults({
    attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
      collapsible: false
    })
  }),
  target: 'map',
  view: new ol.View({
    center: [-8382384.16, 4881879.51],
    zoom: 10
  })
});

const ol3d = new olcs.OLCesium({map: ol2d});
const scene = ol3d.getCesiumScene();
// scene.getGLobe().depthTestAgainstTerrain = true;
const terrainProvider = new Cesium.CesiumTerrainProvider({
  url: '//assets.agi.com/stk-terrain/world'
});
scene.terrainProvider = terrainProvider;

ol3d.getDataSources().add(Cesium.KmlDataSource.load('data/bikeRide.kml', {
      clampToGround: true,
      camera: scene.camera,
      canvas: scene.canvas
    }
));

ol3d.setEnabled(true);
