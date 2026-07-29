# Unity WebGL: Deployment War Stories

The browser tab crashed 6 times before lunch, and I hadn't even pushed to production yet.

Unity WebGL in 2017 was a beautiful promise wrapped in memory leaks. The idea of running complex 3D experiences in the browser without plugins was revolutionary. The reality was that Chrome would happily consume 1.5GB of RAM for a scene that ran at 60fps in the editor, then crash when you tried to load a second asset bundle.

Here's what we learned the hard way:

**Memory Budgets Are Real**

Unity WebGL uses WebAssembly with a fixed memory heap. The default was 256MB. Our interactive experiences needed 512MB minimum. Setting it higher meant longer load times and more browser crashes on low-end machines. We settled on 384MB as the sweet spot for brand experiences.

```html
<!-- Unity WebGL loader with custom memory settings -->
<script>
  var unityInstance = UnityLoader.instantiate(
    "unity-container",
    "Build/Build.json",
    {
      onProgress: onProgress,
      memory: {
        initial: 256 * 1024 * 1024,
        maximum: 512 * 1024 * 1024
      },
      streamingAssetsURL: "StreamingAssets"
    }
  );
</script>
```

**Asset Bundles Changed Everything**

We split our content into asset bundles that loaded on demand. A typical experience had a 10MB boot bundle (UI framework, core systems, shared materials) and 5-20MB content bundles that loaded at interaction points. This turned a 3-minute initial load into a 10-second bootstrap.

```csharp
// Asset bundle manager for WebGL
public class WebGLBundleLoader : MonoBehaviour {
  [SerializeField] private string baseUrl;
  private Dictionary<string, AssetBundle> cache = new();

  public IEnumerator LoadBundle(string bundleName) {
    if (cache.ContainsKey(bundleName)) yield break;

    var url = $"{baseUrl}/bundles/{bundleName}";
    var www = UnityWebRequestAssetBundle.GetAssetBundle(url);

    yield return www.SendWebRequest();

    if (www.result == UnityWebRequest.Result.Success) {
      var bundle = DownloadHandlerAssetBundle.GetContent(www);
      cache[bundleName] = bundle;
    }
  }
}
```

**Streaming Assets Required a CDN**

WebGL can't access the local file system. Every asset must be fetched over HTTP. We set up a CloudFront distribution pointing to S3 with aggressive caching headers and gzip compression. The difference between a US-East server and a Singapore edge node was 4 seconds vs 12 seconds on first load.

The most painful lesson? Test on actual hardware. Our development machines were beefy workstations with 32GB RAM and discrete GPUs. Our users were on MacBook Airs and corporate laptops with integrated Intel graphics. The gap was embarrassing.

WebGL Unity is workable now, but in 2017 it was a daily struggle against browser limitations that Unity's editor never exposed. Every scene I build today still carries the scars of those WebGL deployment nights.
