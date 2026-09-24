# The Apartments · 3D

Sitcom apartments, built in 3D with three.js and running in the browser.

Live: https://barakalmog.github.io/3d-apt/

## The collection

| Apartment | Path | What it has |
| --- | --- | --- |
| Seinfeld, version 2 | [`seinfeld-v2/`](https://barakalmog.github.io/3d-apt/seinfeld-v2/) | The whole cast, Kramer's entrance, light from noon to midnight, the sound stage around the set, a sitcom broadcast mode, a walk-through, sound |
| Seinfeld, version 1 | [`seinfeld-v1/`](https://barakalmog.github.io/3d-apt/seinfeld-v1/) | The first model: the room, Kramer and Newman at the Risk board, the door |

Each apartment is its own folder. The root `index.html` is the gallery that links them.

## Controls (Seinfeld v2)

| Input | Does |
| --- | --- |
| Drag | Orbit. Right-drag or two fingers to pan. |
| Scroll or pinch | Zoom |
| Click a thing | The fridge, TV, bike, lamp, the people: most things do something |
| 1 to 5 | Overview, Audience, Plan, Door, Kitchen |
| K | Let Kramer in |
| T | Play the day through; the slider sets the hour |
| S | Reveal the sound stage around the set |
| C | Sitcom broadcast: 4:3, a 90s look, four cameras |
| F | Walk: WASD or arrows, Shift to hurry, Esc to stop |
| M | Sound on or off |
| P | Save a picture |
| ? or H | Help |

The walls nearest the camera drop to a stub, so the rooms open toward you. From straight above, every wall stands, as on a floor plan.

## Run it locally

There is no build step. The pages load three.js 0.160 from jsDelivr through an import map, and ES modules need a web server, not `file://`.

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/ from the repo root.

## Credits

- 3D library: [three.js](https://threejs.org/), MIT.
- Sounds: CC0 and public-domain recordings from Freesound and Wikimedia Commons, listed in [seinfeld-v2/audio/CREDITS.md](seinfeld-v2/audio/CREDITS.md).

A fan project. The shows and their characters belong to their owners; nothing here is affiliated with them.

## License

The code is MIT, see [LICENSE](LICENSE). The sounds keep their own CC0 and public-domain terms.
