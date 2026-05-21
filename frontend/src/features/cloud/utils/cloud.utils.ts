import { ICloudFlavor, ICloudImage } from "@/features/cloud/interfaces/cloud.interfaces";
import { formatGigabytes, formatMegabytes } from "@/shared/utils/format.util";

export function describeFlavor(flavor: ICloudFlavor): string {
  return `${flavor.vcpus} vCPU · ${formatMegabytes(flavor.ram_mb)} · ${formatGigabytes(flavor.disk_gb)}`;
}

export function describeImage(image: ICloudImage): string {
  const parts = [image.os_type, image.size_mb ? formatMegabytes(image.size_mb) : null].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" · ") : "—";
}
