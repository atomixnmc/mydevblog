# Vision Camera in React Native

React Native Vision Camera is a high-performance camera library for React Native. It exposes native camera APIs through a JS bridge with minimal overhead, supporting real-time frame processing, multi-camera, and code scanning.

## Basic Setup

```tsx
import { Camera, useCameraDevice } from 'react-native-vision-camera';

function CameraView() {
  const device = useCameraDevice('back');

  if (!device) return <Text>No camera available</Text>;

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
    />
  );
}
```

The `useCameraDevice` hook returns a `CameraDevice` object with hardware capabilities — resolution support, frame rate ranges, autofocus modes, and HDR support. Vision Camera queries the native camera system to populate this object, so it only shows what the device actually supports.

## Frame Processors

Frame processors are the killer feature — they run synchronous work on each camera frame using a worklet thread. This keeps the UI thread responsive while processing frames at 30 FPS:

```tsx
import { useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { scanFaces } from 'vision-camera-face-detector';

function FaceDetectionView() {
  const [faces, setFaces] = useState([]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const detectedFaces = scanFaces(frame);
    runOnJS(setFaces)(detectedFaces);
  }, []);

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      frameProcessor={frameProcessor}
      isActive={true}
    />
  );
}
```

Frame processors run on a separate native thread using a JSI-optimized bridge — no JSON serialization, no bridge overhead. The frame is passed as a direct memory reference. This is what makes 30 FPS real-time processing possible. We use this for barcode scanning, OCR, and object detection without noticeable latency.

## Code Scanner API

For barcode scanning, Vision Camera v3 has a built-in Code Scanner API that runs on the GPU's ISP (Image Signal Processor), not in JavaScript:

```tsx
function BarcodeScanner() {
  const [code, setCode] = useState<string>();

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      codeScanner={{
        codeTypes: ['qr', 'ean-13', 'code-128'],
      }}
      onCodeScanned={(codes) => {
        if (codes.length > 0) {
          setCode(codes[0].value);
        }
      }}
      isActive={true}
    />
  );
}
```

The GPU-level scanning consumes zero JavaScript CPU — the camera ISP detects codes in hardware and only sends the decoded value to JS. We benchmarked this against software-based ZXing scanning: the built-in API detected codes 2-3x faster and used 0% JS thread CPU vs. 25-30% for ZXing frame processing. The trade-off is flexibility — the onboard scanner only supports standard formats. For custom patterns (fiducial markers, proprietary codes), you need frame processors with a library like MLKit.

## Performance Considerations

Vision Camera uses CameraX on Android and AVFoundation on iOS — native camera stacks with low overhead. Key performance numbers from our production app:

- Cold start to first frame: 400-600ms (Android), 200-400ms (iOS)
- Frame processor latency: 5-10ms per frame at 30 FPS
- Memory usage: 80-120MB with active camera (resolutions up to 1080p)
- Temperature increase: 3-5°C over 30 minutes of continuous recording

The overhead is almost entirely from the native camera system, not React Native. Switching to 4K recording adds about 200ms to startup time and doubles memory usage. We default to 1080p and expose a settings toggle for users who need higher resolution.

## Zoom and Focus

Vision Camera supports pinch-to-zoom and tap-to-focus out of the box with gesture recognizers that integrate with Reanimated:

```tsx
const { pinch, zoom } = usePinchGesture();
const focus = useFocusGesture();

<Camera
  gesture={pinch}
  gestureZoomFactor={zoom}
  onTouchEnd={focus}
/>
```

The gesture system runs on the UI thread — no JS bridge lag. Smooth zoom animation runs at 60 FPS because the zoom factor is applied directly to the native camera session. The hardware focus ring on iPhone moves incrementally using the focus gesture — this is the smoothest focus experience we've shipped, and it adds no code beyond the gesture handler wiring.