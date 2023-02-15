export const COIN = "thUSD";

const generateFilter = (brightness: number, saturate: number, invert: number, sepia: number, secondSaturate: number, hueRotate: number, secondBrightness: number, contrast: number): string => {
 return `brightness(${brightness}%) saturate(${saturate}%) invert(${invert}%) sepia(${sepia}%) saturate(${secondSaturate}%) hue-rotate(${hueRotate}deg) brightness(${secondBrightness}%) contrast(${contrast}%)`;
};

export const DARK_FILTER = generateFilter(0, 100, 11, 29, 419, 175, 92, 93);
export const WHITE_FILTER = generateFilter(0, 100, 100, 0, 0, 93, 103, 103);
export const PURPLE_FILTER = generateFilter(0, 100, 10, 89, 6813, 273, 104, 113);
export const GREY_FILTER = generateFilter(0, 100, 91, 4, 1507, 185, 84, 89);
