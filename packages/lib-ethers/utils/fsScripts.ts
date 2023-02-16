import fs from 'fs';
import path from 'path';

export interface FolderInfo {
  path: string;
  name: string;
  subfolders?: FolderInfo[];
}

/**
 * Recursively reads a folder and returns an object containing information about the folder and its subfolders.
 * @param {string} folderPath The path of the folder to read.
 * @returns {Promise<FolderInfo>} A Promise that resolves to an object containing information about the folder and its subfolders.
 */
export async function getFolderInfo(folderPath: string): Promise<FolderInfo> {
  // Create an object to store information about the current folder
  const folderInfo: FolderInfo = {
    path: folderPath,
    name: path.posix.basename(folderPath)
  };

  // Read the contents of the folder asynchronously
  const contents = await fs.promises.readdir(folderPath, { withFileTypes: true });

  // Create an array to store Promises for each subfolder
  const subfolderPromises: Promise<FolderInfo>[] = [];

  // Iterate through each item in the folder
  for (const item of contents) {
    // Construct the full path to the item
    const itemPath = path.posix.join(folderPath, item.name);

    // Check if the item is a directory
    if (item.isDirectory()) {
      // If it's a directory, recursively call getFolderInfo and add the resulting Promise to the subfolderPromises array
      subfolderPromises.push(getFolderInfo(itemPath));
    }
  }

  // If there are subfolders, wait for their Promises to resolve and add the results to the current folder's subfolders array
  if (subfolderPromises.length > 0) {
    const subfolders = await Promise.all(subfolderPromises);
    folderInfo.subfolders = subfolders;
  }

  // Return the final folderInfo object
  return folderInfo;
}
