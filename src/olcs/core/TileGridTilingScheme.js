import {
  equivalent as olProjEquivalent,
  fromLonLat as olProjFromLonLat,
  get as olProjGet,
  transformExtent as olProjTransformExtent
} from 'ol/proj';
import {toSize as olSizeToSize} from 'ol/size';
import {ENABLE_RASTER_REPROJECTION} from 'ol/reproj/common.js';

class TileGridTilingScheme {

  /**
   * @param {!ol/source/TileImage} source
   * @extends {Cesium.TilingScheme}
   * @constructor
   */
  constructor(source) {
    var tg = source.getTileGrid();
    if (!tg) {
      // TODO: we need the map projection here
      tg = source.getTileGridForProjection(source.getProjection() || olProjGet('EPSG:3857'));
    }

    /**
     * @type {!ol.tilegrid.TileGrid}
     * @private
     */
    this.tilegrid_ = tg;

    // TODO: we need the map projection here
    var proj = source.getProjection() || olProjGet('EPSG:3857');
    var isGeographic = olProjEquivalent(proj, olProjGet('EPSG:4326'));
    var isWebMercator = olProjEquivalent(proj, olProjGet('EPSG:3857'));

    if (!isGeographic && !isWebMercator && !ENABLE_RASTER_REPROJECTION) {
      throw new Error('Cesium only supports EPSG:4326 and EPSG:3857 projections');
    }

    /**
     * @type {!Cesium.Ellipsoid}
     * @private
     */
    this.ellipsoid_ = Cesium.Ellipsoid.WGS84;

    /**
     * @type {!(Cesium.GeographicProjection|Cesium.WebMercatorProjection)}
     */
    this.cesiumProjection_ = isGeographic ? new Cesium.GeographicProjection(this.ellipsoid_) :
        new Cesium.WebMercatorProjection(this.ellipsoid_);

    /**
     * @type {!ol.proj.Projection}
     * @private
     */
    this.projection_ = /** @type {!ol.proj.Projection} */ (proj);

    var extent = olProjTransformExtent(this.tilegrid_.getExtent(), this.projection_, 'EPSG:4326');
    extent = extent.map(function(deg) {
      return deg * Math.PI / 180;
    });

    /**
     * @type {!Cesium.Rectangle}
     * @private
     */
    this.rectangle_ = new Cesium.Rectangle(extent[0], extent[1], extent[2], extent[3]);
  }


  /**
   * @inheritDoc
   * @suppress {accessControls}
   */
  getNumberOfXTilesAtLevel(level) {
    var tileRange = this.tilegrid_.getFullTileRange(level);
    if (tileRange) {
      return tileRange.maxX - tileRange.minX + 1;
    }

    // Cesium assumes that all levels (0 to maxZoom) exist and uses this function to compute the current
    // zoom level by texel spacing. Therefore, return something other than 0 by extrapolating from the
    // levels which are defined (if a zoom factor was detected).
    var zoomFactor = this.tilegrid_.zoomFactor_;
    if (zoomFactor !== undefined) {
      var minZoom = this.tilegrid_.getMinZoom();
      tileRange = this.tilegrid_.getFullTileRange(minZoom);
      var numXTiles = tileRange.maxX - tileRange.minX + 1;
      return Math.pow(zoomFactor, Math.log(numXTiles) / Math.log(zoomFactor) - minZoom + level);
    }

    return 0;
  }


  /**
   * @inheritDoc
   * @suppress {accessControls}
   */
  getNumberOfYTilesAtLevel(level) {
    var tileRange = this.tilegrid_.getFullTileRange(level);
    if (tileRange) {
      return tileRange.maxY - tileRange.minY + 1;
    }

    // Cesium assumes that all levels exist, so attempt to extrapolate this value if a
    // zoomFactor exists
    var zoomFactor = this.tilegrid_.zoomFactor_;
    if (zoomFactor !== undefined) {
      var minZoom = this.tilegrid_.getMinZoom();
      tileRange = this.tilegrid_.getFullTileRange(minZoom);
      var numYTiles = tileRange.maxY - tileRange.minY + 1;
      return Math.pow(zoomFactor, Math.log(numYTiles) / Math.log(zoomFactor) - minZoom + level);
    }

    return 0;
  }


  /**
   * @inheritDoc
   */
  rectangleToNativeRectangle(rectangle, opt_result) {
    var extent = [
      rectangle.west * 180 / Math.PI,
      rectangle.south * 180 / Math.PI,
      rectangle.east * 180 / Math.PI,
      rectangle.north * 180 / Math.PI];

    extent = olProjTransformExtent(extent, 'EPSG:4326', this.projection_);

    var result = opt_result || new Cesium.Rectangle();
    result.west = extent[0];
    result.south = extent[1];
    result.east = extent[2];
    result.north = extent[3];

    return result;
  }

  /**
   * @inheritDoc
   */
  tileXYToNativeRectangle(x, y, level, opt_result) {
    var rectangle = this.tileXYToRectangle(x, y, level, opt_result);
    return this.rectangleToNativeRectangle(rectangle, opt_result);
  }


  /**
   * @inheritDoc
   */
  tileXYToRectangle(x, y, level, opt_result) {
    var extent = this.tilegrid_.getTileCoordExtent([level, x, -y - 1]);
    extent = olProjTransformExtent(extent, this.projection_, 'EPSG:4326');

    var result = opt_result || new Cesium.Rectangle();
    result.west = extent[0] * Math.PI / 180;
    result.south = extent[1] * Math.PI / 180;
    result.east = extent[2] * Math.PI / 180;
    result.north = extent[3] * Math.PI / 180;

    return result;
  }

  /**
   * @inheritDoc
   * @suppress {accessControls}
   */
  positionToTileXY(position, level, opt_result) {
    if (!this.contains(position)) {
      // outside bounds of tiling scheme
      return undefined;
    }

    var coord = olProjFromLonLat([position.longitude * 180 / Math.PI, position.latitude * 180 / Math.PI], this.projection_);

    var origin = this.tilegrid_.getOrigin(level);
    var resolution = this.tilegrid_.getResolution(level);
    var tileSize = olSizeToSize(this.tilegrid_.getTileSize(level), this.tilegrid_.tmpSize_);

    var x = ((coord[0] - origin[0]) / resolution) / tileSize[0];
    var y = ((origin[1] - coord[1]) / resolution) / tileSize[1];

    var result = opt_result || new Cesium.Cartesian2();
    result.x = Math.floor(x);
    result.y = Math.floor(y);

    return result;
  }

  /**
   * @param {Cesium.Cartographic} position The lon/lat in radians
   * @return {boolean} Whether or not the position is within the tiling scheme
   */
  contains(position) {
    var epsilon = 1E-12;
    var rectangle = this.rectangle_;

    return !(position.latitude - rectangle.north > epsilon ||
        position.latitude - rectangle.south < -epsilon ||
        position.longitude - rectangle.west < -epsilon ||
        position.longitude - rectangle.east > epsilon);
  }
}

Object.defineProperties(TileGridTilingScheme.prototype, {
  'ellipsoid': {
    get:
      /**
       * @return {!Cesium.Ellipsoid}
       * @this plugin.cesium.TileGridTilingScheme
       */
      function() {
        return this.ellipsoid_;
      }
  },

  'rectangle': {
    get:
      /**
       * @return {!Cesium.Rectangle} rectangle in radians covered by the tiling scheme
       * @this plugin.cesium.TileGridTilingScheme
       */
      function() {
        return this.rectangle_;
      }
  },

  'projection': {
    get:
      /**
       * @return {!(Cesium.GeographicProjection|Cesium.WebMercatorProjection)}
       * @this plugin.cesium.TileGridTilingScheme
       */
      function() {
        return this.cesiumProjection_;
      }
  }
});

export default TileGridTilingScheme;
