export interface AutomationPoint {
  id: string;
  time: number;
  value: number;
  curveType: 'linear' | 'stepped' | 'exponential' | 'logarithmic' | 'bezier';
  curveTension?: number;
}
