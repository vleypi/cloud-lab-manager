

export interface ICloudImage {
  id: string;
  name: string;
  os_type: string | null;
  size_mb: number | null;
}

export interface ICloudFlavor {
  id: string;
  name: string;
  vcpus: number;
  ram_mb: number;
  disk_gb: number;
}

export interface ICloudNetwork {
  id: string;
  name: string;
  cidr: string | null;
  is_external: boolean;
}
