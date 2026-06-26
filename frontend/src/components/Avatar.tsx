import { colorFor, initials } from '../lib/format';

interface AvatarProps {
  name: string;
  seed?: string;
  size?: number;
  online?: boolean;
  group?: boolean;
}

export function Avatar({ name, seed, size = 44, online, group }: AvatarProps) {
  const bg = colorFor(seed ?? name);
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {group ? '#' : initials(name)}
      {online && <span className="avatar-dot" title="Online" />}
    </span>
  );
}
