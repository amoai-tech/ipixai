# Linux Performance — Fix Commands

## CPU Governor

Check current:
```bash
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

Switch to performance (lasts until reboot):
```bash
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

Persistent via systemd (Ubuntu/Debian):
```bash
sudo apt install cpufrequtils
echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils
sudo systemctl restart cpufrequtils
```

## Power Profile (GNOME / systemd)

Check:
```bash
powerprofilesctl get
```

Set to performance:
```bash
powerprofilesctl set performance
```

## inotify watches (file watchers — Next.js, Vite, Vitest)

Check:
```bash
cat /proc/sys/fs/inotify/max_user_watches
```

Increase (temporary):
```bash
sudo sysctl fs.inotify.max_user_watches=524288
```

Persistent:
```bash
echo 'fs.inotify.max_user_watches=524288' | sudo tee /etc/sysctl.d/99-inotify.conf
sudo sysctl -p /etc/sysctl.d/99-inotify.conf
```

## zram (swap on RAM — helps when building with limited memory)

Check:
```bash
zramctl
swapon --show
```

Enable (Ubuntu 22.04+):
```bash
sudo apt install zram-config
# or
sudo modprobe zram
```

## I/O Scheduler (for NVMe SSDs)

Check:
```bash
cat /sys/block/nvme0n1/queue/scheduler
```

NVMe SSDs should use `none` — they have internal queuing:
```bash
echo none | sudo tee /sys/block/nvme0n1/queue/scheduler
```

## Check thermals

```bash
# If lm-sensors installed:
sensors | grep -E "Core|temp"

# Without sensors:
paste <(cat /sys/class/thermal/thermal_zone*/type) \
      <(cat /sys/class/thermal/thermal_zone*/temp) \
  | awk '{print $1, $2/1000 "°C"}' | sort -t° -k1 -rn | head -10
```

Warning threshold: >85°C sustained = CPU will throttle.

## RAM check

```bash
free -h
# Available should be >4GB during active dev
# If <2GB available, close browsers/Slack/etc or add swap
```
