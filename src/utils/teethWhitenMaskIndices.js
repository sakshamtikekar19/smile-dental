/**
 * Inner teeth loop for whitening / braces arch width — must match clinical mask in SmileSimulatorAI.
 * Wider than commissures (61/291) so the arch can reach distal molars.
 */
export const TEETH_WHITEN_MASK_INDICES = [
  // Upper Lip (Left to Right)
  13, 312, 311, 310, 415, 308, 
  // Deep Right Cheek Void (Extend right molars)
  291, 
  // Lower Lip (Right to Left)
  324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 
  // Deep Left Cheek Void (Extend left molars)
  61, 
  // Upper Lip (Return to top center)
  191, 80, 81, 82
];
