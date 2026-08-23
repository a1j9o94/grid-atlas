"""Albers conic plus a polynomial warp, for putting lon/lat onto FTC plate pixels.

The plate is almost certainly a polyconic projection, which was the USGS standard of the
period. Albers gets the shape close and the polynomial soaks up the remaining mismatch,
which is why the fit is done in two stages rather than by guessing the projection.
Projected coordinates are scaled to megametres before the polynomial so the least squares
and the optimiser stay well conditioned.
"""
import numpy as np, math, json
LAT0, LON0, SP1, SP2, R = 23.0, -96.0, 29.5, 45.5, 6370997.0
SCALE = 1e6

def albers(lon, lat):
    lon = np.radians(np.asarray(lon, np.float64)); lat = np.radians(np.asarray(lat, np.float64))
    p1,p2,l0,la0 = map(math.radians,(SP1,SP2,LON0,LAT0))
    n = 0.5*(math.sin(p1)+math.sin(p2)); C = math.cos(p1)**2 + 2*n*math.sin(p1)
    rho0 = R*math.sqrt(C-2*n*math.sin(la0))/n
    rho = R*np.sqrt(C-2*n*np.sin(lat))/n
    th = n*(lon-l0)
    return (rho*np.sin(th))/SCALE, (rho0-rho*np.cos(th))/SCALE

NTERMS = {1:3, 2:6, 3:10}
def design(x,y,order):
    c=[np.ones_like(x),x,y]
    if order>=2: c+=[x*x,x*y,y*y]
    if order>=3: c+=[x**3,x*x*y,x*y*y,y**3]
    return np.column_stack(c)

def apply(p,x,y,order):
    k=NTERMS[order]; A=design(x,y,order)
    return A@p[:k], A@p[k:2*k]

def promote(p, o_from, o_to):
    kf,kt = NTERMS[o_from], NTERMS[o_to]
    q = np.zeros(2*kt); q[:kf]=p[:kf]; q[kt:kt+kf]=p[kf:2*kf]
    return q

def ring_points(path, step=0.04):
    g=json.load(open(path)); out=[]
    if g['type']=='GeometryCollection': geoms=g['geometries']
    elif g['type']=='FeatureCollection': geoms=[f['geometry'] for f in g['features']]
    else: geoms=[g]
    def walk(c,d):
        if d==0: return
        if isinstance(c[0][0],(int,float)):
            a=np.asarray(c,np.float64)
            for i in range(len(a)-1):
                dd=max(abs(a[i+1,0]-a[i,0]),abs(a[i+1,1]-a[i,1])); n=max(1,int(dd/step))
                t=np.linspace(0,1,n,endpoint=False)[:,None]
                out.append(a[i][None,:]*(1-t)+a[i+1][None,:]*t)
        else:
            for s in c: walk(s,d-1)
    for gm in geoms:
        walk(gm['coordinates'], {'Polygon':2,'MultiPolygon':3,'LineString':1,'MultiLineString':2}[gm['type']])
    return np.vstack(out)
