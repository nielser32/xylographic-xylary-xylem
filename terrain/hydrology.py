import numpy as np

# Offsets for 8-directional neighborhood (Moore neighborhood)
_NEIGHBOR_OFFSETS = [
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
]


def _steepest_descent(
    height_map: np.ndarray, y: int, x: int
) -> tuple[int, int]:
    """Return the coordinates of the neighbor of steepest descent.

    If no neighbor has a lower elevation, ``(-1, -1)`` is returned to
    indicate a sink.
    """
    current = height_map[y, x]
    best_drop = 0.0
    dest = (-1, -1)
    h, w = height_map.shape

    for oy, ox in _NEIGHBOR_OFFSETS:
        ny, nx = y + oy, x + ox
        if 0 <= ny < h and 0 <= nx < w:
            drop = current - height_map[ny, nx]
            if drop > best_drop:  # strictly downhill
                best_drop = drop
                dest = (ny, nx)

    return dest


def compute_flow_directions(height_map: np.ndarray) -> np.ndarray:
    """Compute flow directions following the steepest descent for each cell.

    Returns
    -------
    np.ndarray
        Array of shape ``(height, width, 2)`` containing destination
        coordinates for each cell. Cells that are local minima have
        ``(-1, -1)`` as their direction.
    """
    h, w = height_map.shape
    directions = np.full((h, w, 2), -1, dtype=np.int32)

    for y in range(h):
        for x in range(w):
            dest_y, dest_x = _steepest_descent(height_map, y, x)
            directions[y, x] = (dest_y, dest_x)

    return directions


def compute_flow_accumulation(
    height_map: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Compute flow accumulation routing water along the steepest descent.

    Each cell contributes one unit of water that is routed to the neighbor with
    the largest drop in elevation. The result is the number of upstream cells
    (including itself) that drain through each cell.

    Returns
    -------
    tuple[np.ndarray, np.ndarray]
        The flow accumulation array and the flow direction array.
    """
    directions = compute_flow_directions(height_map)
    h, w = height_map.shape
    accumulation = np.zeros((h, w), dtype=np.float32)

    # Process cells from highest to lowest elevation
    order = np.argsort(-height_map.ravel())
    for idx in order:
        y, x = divmod(int(idx), w)
        accumulation[y, x] += 1.0  # rainfall at this cell
        dest_y, dest_x = directions[y, x]
        if dest_y >= 0:  # not a sink
            accumulation[dest_y, dest_x] += accumulation[y, x]

    return accumulation, directions


def identify_rivers(accumulation: np.ndarray, threshold: float) -> np.ndarray:
    """Mark cells with high accumulated flow as rivers.

    Parameters
    ----------
    accumulation : np.ndarray
        Flow accumulation array from :func:`compute_flow_accumulation`.
    threshold : float
        If less than 1.0, interpreted as a fraction of the maximum
        accumulation. Otherwise, treated as an absolute accumulation value.

    Returns
    -------
    np.ndarray
        Boolean mask where ``True`` indicates river cells.
    """
    if threshold < 1.0:
        threshold_value = accumulation.max() * threshold
    else:
        threshold_value = threshold
    return accumulation >= threshold_value


def identify_basins(directions: np.ndarray) -> np.ndarray:
    """Identify basins draining to local minima (potential lakes).

    Parameters
    ----------
    directions : np.ndarray
        Flow direction array as returned by :func:`compute_flow_directions`.

    Returns
    -------
    np.ndarray
        Array of the same shape as ``directions[..., 0]`` where each unique
        integer denotes a basin id. Cells that drain to the same sink share the
        same id.
    """
    h, w, _ = directions.shape
    basins = np.full((h, w), -1, dtype=np.int32)
    next_id = 0

    for y in range(h):
        for x in range(w):
            path = []
            cy, cx = y, x
            while True:
                if basins[cy, cx] != -1:
                    basin_id = basins[cy, cx]
                    break
                dy, dx = directions[cy, cx]
                path.append((cy, cx))
                if dy < 0:  # sink
                    basin_id = next_id
                    next_id += 1
                    break
                cy, cx = dy, dx
            for py, px in path:
                basins[py, px] = basin_id

    return basins
