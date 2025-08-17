import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Point, Polygon, Feature, FeatureCollection } from 'geojson';
import * as turf from '@turf/turf';

@Injectable()
export class GeospatialService {
  private readonly logger = new Logger(GeospatialService.name);

  constructor(private readonly configService: ConfigService) {}

  calculateDistance(point1: Point, point2: Point): number {
    const from = turf.point(point1.coordinates);
    const to = turf.point(point2.coordinates);
    
    return turf.distance(from, to, { units: 'kilometers' });
  }

  calculatePolygonArea(polygon: Polygon): number {
    const polygonFeature = turf.polygon(polygon.coordinates);
    const area = turf.area(polygonFeature);
    
    return area / 10000;
  }

  isPointInPolygon(point: Point, polygon: Polygon): boolean {
    const pointFeature = turf.point(point.coordinates);
    const polygonFeature = turf.polygon(polygon.coordinates);
    
    return turf.booleanPointInPolygon(pointFeature, polygonFeature);
  }

  calculatePolygonCentroid(polygon: Polygon): Point {
    const polygonFeature = turf.polygon(polygon.coordinates);
    const centroid = turf.centroid(polygonFeature);
    
    return centroid.geometry as Point;
  }

  simplifyPolygon(polygon: Polygon, tolerance: number = 0.01): Polygon {
    const polygonFeature = turf.polygon(polygon.coordinates);
    const simplified = turf.simplify(polygonFeature, { tolerance, highQuality: false });
    
    return simplified.geometry as Polygon;
  }

  bufferPoint(point: Point, radius: number): Polygon {
    const pointFeature = turf.point(point.coordinates);
    const buffered = turf.buffer(pointFeature, radius, { units: 'kilometers' });
    
    return buffered.geometry as Polygon;
  }

  validateCoordinates(longitude: number, latitude: number): boolean {
    return (
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90
    );
  }

  validatePolygon(polygon: Polygon): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      const polygonFeature = turf.polygon(polygon.coordinates);

      if (polygon.coordinates.length === 0) {
        errors.push('Polygon must have at least one ring');
      }

      const firstRing = polygon.coordinates[0];
      if (firstRing.length < 4) {
        errors.push('Polygon ring must have at least 4 coordinates');
      }

      const firstCoord = firstRing[0];
      const lastCoord = firstRing[firstRing.length - 1];
      if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
        errors.push('Polygon ring must be closed (first and last coordinates must be the same)');
      }

      for (const coord of firstRing) {
        if (!this.validateCoordinates(coord[0], coord[1])) {
          errors.push(`Invalid coordinates: [${coord[0]}, ${coord[1]}]`);
        }
      }

      const kinks = turf.kinks(polygonFeature);
      if (kinks.features.length > 0) {
        errors.push('Polygon has self-intersections');
      }

    } catch (error) {
      errors.push(`Invalid polygon geometry: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  convertToGeoJSON(farms: any[]): FeatureCollection {
    const features: Feature[] = farms.map(farm => ({
      type: 'Feature',
      geometry: farm.boundaryPolygon || farm.locationPoint,
      properties: {
        id: farm.id,
        name: farm.name,
        area: farm.area,
        areaUnit: farm.areaUnit,
        organicCertified: farm.organicCertified,
        certificationStatus: farm.certificationStatus,
        soilType: farm.soilType,
        state: farm.state,
        district: farm.district,
      },
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  calculateBoundingBox(points: Point[]): {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } {
    if (points.length === 0) {
      throw new Error('Cannot calculate bounding box for empty array');
    }

    let minLng = points[0].coordinates[0];
    let maxLng = points[0].coordinates[0];
    let minLat = points[0].coordinates[1];
    let maxLat = points[0].coordinates[1];

    for (const point of points) {
      const [lng, lat] = point.coordinates;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    return { minLng, minLat, maxLng, maxLat };
  }

  generateGridPoints(
    boundingBox: { minLng: number; minLat: number; maxLng: number; maxLat: number },
    cellSize: number,
  ): Point[] {
    const bbox: [number, number, number, number] = [
      boundingBox.minLng,
      boundingBox.minLat,
      boundingBox.maxLng,
      boundingBox.maxLat,
    ];

    const grid = turf.pointGrid(bbox, cellSize, { units: 'kilometers' });
    
    return grid.features.map(feature => feature.geometry as Point);
  }

  findNearestPoint(targetPoint: Point, candidatePoints: Point[]): {
    nearestPoint: Point;
    distance: number;
  } | null {
    if (candidatePoints.length === 0) {
      return null;
    }

    let nearestPoint = candidatePoints[0];
    let minDistance = this.calculateDistance(targetPoint, nearestPoint);

    for (let i = 1; i < candidatePoints.length; i++) {
      const distance = this.calculateDistance(targetPoint, candidatePoints[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = candidatePoints[i];
      }
    }

    return {
      nearestPoint,
      distance: minDistance,
    };
  }

  convertCoordinateSystem(
    longitude: number,
    latitude: number,
    fromEPSG: number = 4326,
    toEPSG: number = 3857,
  ): { x: number; y: number } {
    if (fromEPSG === 4326 && toEPSG === 3857) {
      const x = longitude * 20037508.34 / 180;
      const y = Math.log(Math.tan((90 + latitude) * Math.PI / 360)) / (Math.PI / 180);
      const mercatorY = y * 20037508.34 / 180;
      
      return { x, y: mercatorY };
    }

    throw new Error(`Coordinate system conversion from EPSG:${fromEPSG} to EPSG:${toEPSG} not implemented`);
  }

  generateFarmBoundaryFromPoint(
    centerPoint: Point,
    area: number,
    areaUnit: string = 'acres',
  ): Polygon {
    let areaInSquareMeters = area;

    switch (areaUnit.toLowerCase()) {
      case 'acres':
        areaInSquareMeters = area * 4046.86;
        break;
      case 'hectares':
        areaInSquareMeters = area * 10000;
        break;
      case 'sqft':
        areaInSquareMeters = area * 0.092903;
        break;
      case 'sqm':
        break;
      default:
        throw new Error(`Unsupported area unit: ${areaUnit}`);
    }

    const radius = Math.sqrt(areaInSquareMeters / Math.PI) / 1000;

    const circle = turf.circle(centerPoint.coordinates, radius, { units: 'kilometers' });
    
    return circle.geometry as Polygon;
  }
}