// Everything is stored in metric (kg, cm, ml). Imperial is only used for display and input.

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const lbsToKg = (lbs) => lbs * KG_PER_LB;
export const kgToLbs = (kg) => kg / KG_PER_LB;
export const inToCm = (inches) => inches * CM_PER_IN;
export const cmToIn = (cm) => cm / CM_PER_IN;
