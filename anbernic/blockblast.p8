pico-8 cartridge // http://www.pico-8.com
version 41
__lua__
-- block blast: rg35xx edition
-- pico-8 cart for anbernic handhelds
-- (fake08 / pico-8) and computers

bx,by,cs=4,22,11
cols={8,9,10,11,12,14}
lt={[8]=14,[9]=10,[10]=7,[11]=7,[12]=6,[14]=15,[13]=6,[6]=7,[7]=7,[15]=7}
dk={[8]=2,[9]=4,[10]=9,[11]=3,[12]=13,[14]=2,[13]=2,[6]=13,[7]=6,[15]=9}
praise=split("good!,great!,excellent!,amazing!,incredible!,unbelievable!")
crown="x.x.x/xxxxx/xxxxx"
gem="..x../.xxx./xxxxx/.xxx./..x.."
star="...x.../..xxx../xxxxxxx/.xxxxx./.xx.xx./xx...xx"
lock=".xxx./x...x/xxxxx/xx.xx/xxxxx"
dxs,dys={-1,1,0,0},{0,0,-1,1}
-- every piece in the game, rows split by /
shapes="x|xx|xxx|xxxx|xxxxx|x/x|x/x/x|x/x/x/x|x/x/x/x/x|xx/xx|xxx/xxx/xxx|xx/xx/xx|xxx/xxx|x./xx|xx/x.|.x/xx|xx/.x|x../x../xxx|..x/..x/xxx|xxx/x../x..|xxx/..x/..x|x./x./xx|.x/.x/xx|xx/x./x.|xx/.x/.x|xxx/x..|xxx/..x|x../xxx|..x/xxx|xxx/.x.|.x./xxx|x./xx/x.|.x/xx/.x|xx./.xx|.xx/xx.|x./xx/.x|.x/xx/x.|x./.x|.x/x.|x../.x./..x|..x/.x./x.."
-- themes: name,backdrop,slots,accent,
-- deco colour,deco kind,drift x,drift y,music
themesrc="classic,140,129,10,12,3,0,-.15,0|night,130,129,14,7,1,0,0,16|candy,141,130,15,14,2,0,-.3,8|forest,3,128,11,11,4,.15,.3,0|ocean,131,129,12,12,2,0,-.4,16|sunset,132,130,9,9,1,.05,-.3,8"

function _init()
 cartdata("rg35xx_blockblast_1")
 shp={}
 for d in all(split(shapes,"|")) do
  local rows,s=split(d,"/",false),{c={}}
  s.h,s.w=#rows,#rows[1]
  for y=1,s.h do
   for x=1,s.w do
    if sub(rows[y],x,x)=="x" then add(s.c,{x-1,y-1}) end
   end
  end
  add(shp,s)
 end
 themes={}
 for d in all(split(themesrc,"|")) do add(themes,split(d)) end
 -- grab the font's pixels so text can be drawn big
 bf={}
 local ch="abcdefghijklmnopqrstuvwxyz0123456789!+/:-."
 for i=1,#ch do
  local c,m=sub(ch,i,i),{}
  cls()
  print(c,0,0,7)
  for y=0,5 do
   for x=0,3 do
    if pget(x,y)==7 then add(m,{x,y}) end
   end
  end
  bf[c]=m
 end
 bh,bl,mx,mo,ab=dget(0),dget(1),max(dget(2),1),dget(3),dget(4)
 theme=max(dget(5),1)
 lv,st,tt,shk,msel,ci=mx,"title",0,0,1,1
 for i=2,40 do if open(i) then ci=i end end
 pt,ft,cf,rg={},{},{},{}
 setmenu()
 usetheme(theme)
end

-- swap the screen palette, background
-- critters and music to a theme
function usetheme(i)
 th,ti=themes[i],i
 pal(1,th[2],1)
 pal(5,th[3],1)
 dc={}
 for k=1,24 do add(dc,{x=rnd(128),y=rnd(128),s=rnd()}) end
 if mo==0 and th[9]~=mu then music(th[9]) mu=th[9] end
end

function setmenu()
 menuitem(1,"music: "..(mo==0 and "on" or "off"),function()
  mo=1-mo dset(3,mo)
  mu=nil
  if mo==0 then usetheme(ti) else music(-1) end
  setmenu()
  return true
 end)
 menuitem(2,"swap a/b: "..(ab==0 and "off" or "on"),function()
  ab=1-ab dset(4,ab)
  setmenu()
  return true
 end)
 menuitem(3,"quit to title",function() totitle() end)
end

function totitle()
 st="title"
 usetheme(theme)
end

-- campaign world's theme for level ci
function wt() return flr((ci-1)/8)+2 end

-- a = place/confirm, b = swap/back
function ka() return btnp(4+ab) end
function kb() return btnp(5-ab) end
function ga() return ab==0 and "\142" or "\151" end
function gb() return ab==0 and "\151" or "\142" end

function pick(t) return t[flr(rnd(#t))+1] end

-- campaign: stars live in slots 10-49
function stars(i) return dget(9+i) end
function open(i) return i==1 or stars(i-1)>0 end
function unlocked(i) return i<2 or stars((i-1)*8)>0 end

function newgame()
 b,gm={},{}
 for i=0,63 do b[i]=0 end
 sh,sl,dsh,dsl,cb,cm,gl,got,nb,ln,mv=0,0,0,0,0,0,0,0,false,0,0
 gt=3
 if mode==2 then
  fill(lv*99,min(8+lv*2,32),min(2+lv,16))
 elseif mode==3 then
  -- goal cycles: points, lines, gems
  gt=ci%3+1
  local d=flr(ci/3)+1
  fill(ci*131,gt==3 and min(8+d*2,30) or min(ci-1,20),gt==3 and min(2+d,14) or 0)
  tgt=({100+ci*25,3+flr(ci/4)})[gt] or gl
  par=({flr(tgt/14)+4,tgt*2+3,gl*2+5})[gt]
  usetheme(wt())
 end
 if gt==3 then tgt=gl end
 cx,cy,pt,ft,cf,rg=2,2,{},{},{},{}
 newhand()
 st="play"
end

function fill(sd,n,g)
 srand(sd)
 for k=1,n do b[flr(rnd(64))]=pick(cols) end
 local r,c=lines()
 for j in all(r) do b[j*8+flr(rnd(8))]=0 end
 for j in all(c) do b[flr(rnd(8))*8+j]=0 end
 for k=1,200 do
  local i=flr(rnd(64))
  if gl<g and b[i]>0 and not gm[i] then
   gm[i]=true gl=gl+1
  end
 end
 srand(t())
end

function prog()
 if gt==1 then return sh>0 and 9999 or sl end
 return gt==2 and ln or got
end

function fits(s,x,y)
 if x<0 or y<0 or x+s.w>8 or y+s.h>8 then return false end
 for p in all(s.c) do
  if b[(y+p[2])*8+x+p[1]]>0 then return false end
 end
 return true
end

function canfit(s)
 for y=0,8-s.h do
  for x=0,8-s.w do
   if fits(s,x,y) then return true end
  end
 end
end

-- rows/cols that would be full with s at x,y
function lines(s,x,y)
 local t,r,c={},{},{}
 for i=0,63 do t[i]=b[i] end
 if s then
  for p in all(s.c) do t[(y+p[2])*8+x+p[1]]=1 end
 end
 for j=0,7 do
  local fr,fc=1,1
  for k=0,7 do
   if t[j*8+k]==0 then fr=nil end
   if t[k*8+j]==0 then fc=nil end
  end
  if fr then add(r,j) end
  if fc then add(c,j) end
 end
 return r,c
end

-- -1 if no room, else most lines it can clear
function best(s)
 local v=-1
 for y=0,8-s.h do
  for x=0,8-s.w do
   if fits(s,x,y) then
    local r,c=lines(s,x,y)
    v=max(v,#r+#c)
   end
  end
 end
 return v
end

-- deal 3 pieces; often favour helpful ones,
-- and make sure at least one fits
function newhand()
 for k=1,12 do
  hand={}
  local ok
  for i=1,3 do
   local bs,bv
   for j=1,rnd()<.4 and 4 or 1 do
    local s=pick(shp)
    local v=best(s)
    if not bs or v>bv then bs,bv=s,v end
   end
   hand[i]={s=bs,c=pick(cols)}
   ok=ok or bv>=0
  end
  if ok then break end
 end
 sel=1
 clamp()
end

function clamp()
 local s=hand[sel].s
 cx,cy=mid(0,cx,8-s.w),mid(0,cy,8-s.h)
end

function swap()
 repeat sel=sel%3+1 until hand[sel]
 clamp()
end

function addsc(n)
 sl=sl+n
 while sl>=10000 do sl=sl-10000 sh=sh+1 end
 if mode==1 and (sh>bh or sh==bh and sl>bl) then
  if not nb and bh+bl>0 then pop("new best!",10) sfx(10) end
  nb,bh,bl=true,sh,sl
  dset(0,bh) dset(1,bl)
 end
end

-- score as text (two halves: pico-8
-- numbers stop at 32767)
function scs(h,l)
 if h<1 then return tostr(l) end
 local s=tostr(l)
 while #s<4 do s="0"..s end
 return h..s
end

function pop(s,c,z)
 add(ft,{s=s,c=c,t=0,z=z,y=z and 44 or 60+#ft*7})
end

function clr(i)
 local c=b[i]
 if c>0 then
  local x,y=bx+i%8*cs,by+flr(i/8)*cs
  add(cf,{x=x,y=y,c=c,t=10})
  for k=1,4 do
   add(pt,{x=x+5,y=y+5,dx=rnd(2)-1,dy=-rnd(2),c=k>2 and lt[c] or c,t=20+rnd(15),z=k%2})
  end
  if gm[i] then
   got=got+1 gm[i]=nil
   sfx(11)
   for k=1,8 do
    add(pt,{x=x+5,y=y+5,dx=rnd(3)-1.5,dy=-rnd(3),c=k%2*5+7,t=35,z=0})
   end
  end
  b[i]=0
 end
end

function place()
 local h=hand[sel]
 local s=h.s
 if not fits(s,cx,cy) then sfx(6) shk=3 return end
 local r,c=lines(s,cx,cy)
 for p in all(s.c) do
  local i=(cy+p[2])*8+cx+p[1]
  b[i]=h.c
  add(rg,{x=bx+i%8*cs,y=by+flr(i/8)*cs,t=8})
 end
 sfx(1)
 mv=mv+1
 addsc(#s.c)
 local n=#r+#c
 ln=ln+n
 for j in all(r) do for k=0,7 do clr(j*8+k) end end
 for j in all(c) do for k=0,7 do clr(k*8+j) end end
 if n>0 then
  -- combo grows while you keep clearing;
  -- 3 placements without a clear breaks it
  cb,cm=cb+1,0
  local p,q=5*n*(n+1)*min(cb,20),min(n+flr(cb/3),6)
  addsc(p)
  sfx(1+min(q,4))
  shk=min(n*2,8)
  pop(praise[q],pick(cols),2)
  pop("+"..p,7)
  if cb>1 then pop("combo x"..cb,14) end
  local e=true
  for i=0,63 do if b[i]>0 then e=false end end
  if e then addsc(300) pop("all clear! +300",11) sfx(10) end
 else
  cm=cm+1
  if cm>=3 then cb=0 end
 end
 hand[sel]=false
 if hand[1] or hand[2] or hand[3] then swap() else newhand() end
 if mode>1 and prog()>=tgt then
  st,ot,sr="win",0,0
  sfx(9)
  if mode==2 then
   if lv>=mx then mx=lv+1 dset(2,mx) end
  else
   sr=mv<=par and 3 or mv<=par*1.6 and 2 or 1
   if ci%8==0 and stars(ci)==0 then
    pop(themes[ci/8+1][1].." theme unlocked!",10)
    sfx(14)
   end
   if sr>stars(ci) then dset(9+ci,sr) end
  end
  return
 end
 for i=1,3 do
  if hand[i] and canfit(hand[i].s) then return end
 end
 st,ot="over",0
 sfx(8)
end

function _update60()
 tt=tt+1
 shk=max(shk-.5,0)
 for d in all(dc) do
  d.x=(d.x+th[7]*(.5+d.s)+(th[6]==4 and sin(tt/120+d.s)*.2 or 0))%128
  d.y=(d.y+th[8]*(.5+d.s))%128
 end
 for p in all(pt) do
  p.x=p.x+p.dx p.y=p.y+p.dy p.dy=p.dy+.15 p.t=p.t-1
  if p.t<0 then del(pt,p) end
 end
 for l in all({cf,rg}) do
  for f in all(l) do
   f.t=f.t-1
   if f.t<0 then del(l,f) end
  end
 end
 for f in all(ft) do
  f.t=f.t+1
  if f.t>55 then del(ft,f) end
 end
 if st=="title" then
  if btnp(2) then msel=(msel-2)%4+1 sfx(0) end
  if btnp(3) then msel=msel%4+1 sfx(0) end
  if msel==3 then
   if btnp(0) then lv=max(lv-1,1) sfx(0) end
   if btnp(1) then lv=min(lv+1,mx) sfx(0) end
  end
  if ka() then
   sfx(7)
   if msel==1 then mode=1 newgame()
   elseif msel==3 then mode=2 newgame()
   elseif msel==2 then st="map"
   else st,tsel="themes",theme end
  end
 elseif st=="map" then
  for i=0,3 do
   if btnp(i) then
    ci=mid(1,ci+({-1,1,-8,8})[i+1],40)
    sfx(0)
   end
  end
  if ka() then
   if open(ci) then sfx(7) mode=3 newgame() else sfx(6) end
  elseif kb() then sfx(15) st="title" end
 elseif st=="themes" then
  if btnp(0) or btnp(1) then
   tsel=(tsel+(btnp(0) and -2 or 0))%6+1
   usetheme(tsel)
   sfx(0)
  end
  if ka() then
   if unlocked(tsel) then
    theme=tsel dset(5,theme) sfx(7) totitle()
   else sfx(6) shk=3 end
  elseif kb() then sfx(15) totitle() end
 else
  -- roll the shown score up to the real one
  if sh-dsh>2 then dsh,dsl=sh,sl end
  local d=(sh-dsh)*10000+sl-dsl
  if d>0 then
   dsl=dsl+max(1,flr(d/8))
   while dsl>=10000 do dsl=dsl-10000 dsh=dsh+1 end
  end
  if st=="play" then
   for i=0,3 do
    if btnp(i) then
     cx,cy=cx+dxs[i+1],cy+dys[i+1]
     sfx(0)
    end
   end
   clamp()
   if ka() then place()
   elseif kb() then swap() sfx(13) end
  else
   ot=ot+1
   if mode==3 and st=="win" and ot%14==0 and ot/14-3<=sr and ot>=56 then sfx(12) end
   if ot>45 then
    if ka() then
     if st=="win" then
      if mode==2 then lv=min(lv+1,mx) else ci=min(ci+1,40) end
     end
     newgame()
    elseif kb() then
     sfx(15)
     if mode==3 then st="map" usetheme(theme) else totitle() end
    end
   end
  end
 end
end

-- tiny bitmaps, optionally scaled by z
function bm(s,x,y,c,z)
 z=z or 1
 local rows=split(s,"/",false)
 for j=1,#rows do
  for i=1,#rows[j] do
   if sub(rows[j],i,i)=="x" then
    rectfill(x+(i-1)*z,y+(j-1)*z,x+i*z-1,y+j*z-1,c)
   end
  end
 end
end

-- chunky outlined text, z times normal size
function bigp(s,x,y,c,z)
 for pass=0,1 do
  for i=1,#s do
   for p in all(bf[sub(s,i,i)] or {}) do
    local px,py=x+(i-1)*4*z+p[1]*z,y+p[2]*z
    if pass==0 then rectfill(px-1,py-1,px+z,py+z,0)
    else rectfill(px,py,px+z-1,py+z-1,p[2]<2 and lt[c] or c) end
   end
  end
 end
end

function cbig(s,y,c) bigp(s,64-#s*4,y,c,2) end

-- glossy bevelled block
function blk(x,y,c,s)
 s=s or 10
 local e=s-1
 rectfill(x,y,x+e,y+e,lt[c])
 rectfill(x+1,y+1,x+e,y+e,dk[c])
 rectfill(x+1,y+1,x+e-1,y+e-1,c)
 if s>6 then
  line(x+2,y+e-1,x+e-1,y+e-1,dk[c])
  line(x+2,y+2,x+3,y+2,7)
  pset(x+2,y+3,7)
 end
end

-- box with clipped corners
function rbox(x0,y0,x1,y1,c)
 rectfill(x0+1,y0,x1-1,y1,c)
 rectfill(x0,y0+1,x1,y1-1,c)
end

function otx(s,x,y,c)
 for i=-1,1 do
  for j=-1,1 do print(s,x+i,y+j,0) end
 end
 print(s,x,y,c)
end

function ctx(s,y,c) otx(s,64-#s*2,y,c) end

function _draw()
 cls(1)
 -- background critters for the theme
 for d in all(dc) do
  local x,y,c,k=flr(d.x),flr(d.y),th[5],th[6]
  if k==1 then
   if (tt+d.s*300)%90<60 then pset(x,y,c) end
   if d.s>.8 then pset(x-1,y,13) pset(x+1,y,13) end
  elseif k==2 then circ(x,y,1+d.s*2,c)
  elseif k==3 then rect(x,y,x+2+d.s*2,y+2+d.s*2,c)
  else line(x,y,x+1,y+1,c) pset(x+1,y,dk[c]) end
 end
 camera(rnd(shk)-shk/2,rnd(shk)-shk/2)
 if st=="title" then drawtitle()
 elseif st=="map" then drawmap()
 elseif st=="themes" then drawthemes()
 else drawgame() end
 camera()
end

function logo(y)
 for k=1,5 do
  local o=sin(tt/90+k/10)*2
  for r=0,1 do
   local x,yy,c=22+k*12,y+r*14+o,cols[(k+r)%6+1]
   blk(x,yy,c,12)
   print(sub(r==0 and "block" or "blast",k,k),x+4,yy+4,dk[c])
   print(sub(r==0 and "block" or "blast",k,k),x+4,yy+3,7)
  end
 end
end

function drawtitle()
 logo(10)
 ctx("rg35xx edition",42,th[4])
 local o={"classic","campaign","adventure \139 lv "..lv.." \145","themes"}
 for k=1,4 do
  local y=46+k*11
  if msel==k then rbox(14,y-3,114,y+7,0) end
  ctx(o[k],y,msel==k and 7 or 6)
 end
 local n=0
 for i=1,40 do n=n+stars(i) end
 bm(crown,24,107,10)
 print(scs(bh,bl),31,106,10)
 bm(star,78,105,10)
 print(n.."/120",87,106,10)
 ctx(ga().." start",118,7)
end

function drawmap()
 cbig("campaign",2,th[4])
 for i=1,40 do
  local x,y=5+(i-1)%8*15,17+flr((i-1)/8)*18
  if open(i) then
   blk(x,y,themes[flr((i-1)/8)+2][5],12)
   local s=tostr(i)
   print(s,x+7-#s*2,y+4,0)
   for k=1,3 do
    rectfill(x-1+k*3,y+13,x+k*3,y+14,k<=stars(i) and 10 or 0)
   end
  else
   rbox(x,y,x+11,y+11,5)
   bm(lock,x+4,y+4,6)
  end
  if i==ci and tt%30<20 then rect(x-1,y-1,x+12,y+12,7) end
 end
 local w=flr((ci-1)/8)+2
 otx("world "..(w-1)..": "..themes[w][1].." - level "..ci,3,108,7)
 otx(({"goal: score "..100+ci*25,"goal: clear "..3+flr(ci/4).." lines","goal: collect every gem"})[ci%3+1],3,115,6)
 print(ga().."play "..gb().."back",74,122,6)
end

function drawthemes()
 cbig("themes",4,th[4])
 cbig(th[1],22,7)
 -- sample board in this theme
 rbox(32,40,96,90,0)
 for i=0,24 do
  local x,y=34+i%5*12,42+flr(i/5)*10
  if (i*7)%5<2 then rectfill(x,y,x+10,y+8,5)
  else blk(x+1,y,cols[i%6+1],9) end
 end
 otx("\139",22,62,7)
 otx("\145",98,62,7)
 if unlocked(tsel) then
  ctx(tsel==theme and "in use" or ga().." use this theme",98,tsel==theme and 11 or 7)
 else
  bm(lock,62,96,7)
  ctx("beat world "..(tsel-1).." to unlock",104,8)
 end
 ctx(gb().." back",118,6)
end

function drawgame()
 -- top bar
 if mode==1 then
  bm(crown,3,3,10)
  print(scs(bh,bl),10,2,10)
 else
  local s=mode==2 and "lv "..lv or flr((ci-1)/8)+1 .."-"..(ci-1)%8+1 .." mv "..mv
  print(s,3,2,th[4])
  s=gt==3 and got.."/"..tgt or (gt==1 and "pts " or "lines ")..min(prog(),tgt).."/"..tgt
  print(s,126-#s*4,2,7)
  if gt==3 then bm(gem,119-#s*4,2,7) end
 end
 local s=scs(dsh,dsl)
 bigp(s,64-#s*4,8,7,2)
 -- board with a dithered drop shadow
 fillp(23130.5)
 rbox(bx,by,bx+91,by+91,0)
 fillp()
 rbox(bx-3,by-3,bx+88,by+88,0)
 local h=st=="play" and hand[sel]
 local pv,ok={}
 if h then
  ok=fits(h.s,cx,cy)
  if ok then
   -- light up lines this move would clear
   local r,c=lines(h.s,cx,cy)
   for j in all(r) do for k=0,7 do pv[j*8+k]=1 end end
   for j in all(c) do for k=0,7 do pv[k*8+j]=1 end end
  end
 end
 for i=0,63 do
  local x,y,c=bx+i%8*cs,by+flr(i/8)*cs,b[i]
  if c>0 then
   if pv[i] then c=h.c end
   if st=="over" and flr(i/8)<ot/4 then c=6 end
   blk(x,y,c)
   if gm[i] then
    bm(gem,x+2,y+2,7)
    if (tt+i*7)%90<6 then pset(x+4,y+4,12) end
   end
  else
   rbox(x,y,x+9,y+9,5)
  end
 end
 for f in all(rg) do
  local d=(8-f.t)/2
  rect(f.x-d,f.y-d,f.x+9+d,f.y+9+d,f.t>4 and 7 or 6)
 end
 for f in all(cf) do
  local m=(10-f.t)/2
  rectfill(f.x+m,f.y+m,f.x+9-m,f.y+9-m,f.t>7 and 7 or f.c)
 end
 -- the piece you are holding
 if h then
  for p in all(h.s.c) do
   local x,y=bx+(cx+p[1])*cs,by+(cy+p[2])*cs
   if ok then
    -- lifted off the board, with a shadow
    rectfill(x+1,y+1,x+10,y+10,0)
    blk(x-1,y-1,h.c)
    rect(x-1,y-1,x+8,y+8,tt%40<20 and 7 or lt[h.c])
   else
    fillp(23130.5)
    rectfill(x,y,x+9,y+9,h.c)
    fillp()
    rect(x,y,x+9,y+9,8)
   end
  end
 end
 -- tray: the three pieces
 for i=1,3 do
  local y,h=by-2+(i-1)*31,hand[i]
  rbox(95,y,126,y+28,i==sel and st=="play" and (tt%30<20 and 7 or th[4]) or 0)
  rbox(96,y+1,125,y+27,5)
  if h then
   local s=h.s
   local c=canfit(s) and h.c or 6
   for p in all(s.c) do
    blk(111-s.w*3+p[1]*6,y+15-s.h*3+p[2]*6,c,5)
   end
  end
 end
 for p in all(pt) do rectfill(p.x,p.y,p.x+p.z,p.y+p.z,p.c) end
 for f in all(ft) do
  if f.t<45 or tt%4<2 then
   local y=f.y-f.t/3
   if f.z then bigp(f.s,64-#f.s*4,y-4,f.c,2)
   else otx(f.s,48-#f.s*2,y+12,f.c) end
  end
 end
 -- bottom bar: combo + controls
 if cb>0 then
  print("combo "..cb,3,117,14)
  for k=1,3 do
   rectfill(38+k*5,117,41+k*5,120,k<=3-cm and 14 or 0)
  end
 end
 print(ga().."place "..gb().."swap",70,117,6)
 -- end screens
 if st~="play" and ot>40 then
  rbox(10,34,118,100,7)
  rbox(11,35,117,99,0)
  if st=="win" then cbig("clear!",40,11)
  else cbig(mode==1 and "game over" or "failed",40,8) end
  if mode==3 then
   ctx("level "..ci.." - "..mv.." moves",56,7)
   if st=="win" then
    for k=1,3 do
     bm(star,24+k*18,66,ot>=42+k*14 and k<=sr and 10 or 5,2)
    end
   else ctx("goal: "..min(prog(),tgt).."/"..tgt,68,6) end
  else
   ctx("score "..scs(sh,sl),58,7)
   if mode==1 then ctx(nb and "new best!" or "best "..scs(bh,bl),67,10)
   elseif st=="win" then ctx("level "..lv.." done",67,10) end
  end
  ctx(ga()..(st=="win" and "next " or "retry ")..gb()..(mode==3 and "map" or "menu"),88,6)
 end
end
__sfx__
000200003002500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000300001a15314635000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0003000024050280502b0503005500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00030000260502a0502d0503205036055000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00030000285502c5502f55034550385503b5550000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000300002b5602f56032560375603b5603e5603f56500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000500001224011245000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000200002d03034035000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000c00002b34028340243401f3401c340183450000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0007000024450284502b450304502b450304503445037450374503745500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000200003c040370403e040390403f0403b0403f04500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00010000370403e0403b0403f04500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0004000030550375503c0450000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00020000280312f035000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0005000024450284502b4503045034450374503c4503c4503f4503f45500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000200002f03028035000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000001514000000000002112500000000001c135000001514000000000000000000000000001c135000001514000000000002112500000000001c135000001514000000000000000000000000001c13500000
001000001114000000000001d1250000000000181350000011140000000000000000000000000018135000001114000000000001d125000000000018135000001114000000000000000000000000001813500000
001000000c140000000000018125000000000013135000000c140000000000000000000000000013135000000c140000000000018125000000000013135000000c14000000000000000000000000001313500000
001000001314000000000001f12500000000001a135000001314000000000000000000000000001a135000001314000000000001f12500000000001a135000001314000000000000000000000000001a13500000
001000002103000000240200000028030000002d020000002403000000210200000021030000002102000000240300000028020000002d0300000024020000002103000000210200000021030000002402000000
001000001d0300000021020000002403000000290200000021030000001d020000001d030000001d0200000021030000002402000000290300000021020000001d030000001d020000001d030000002102000000
001000001f03000000240200000028030000002b0200000024030000001f020000001f030000001f02000000240300000028020000002b0300000024020000001f030000001f020000001f030000002402000000
001000001f03000000230200000026030000002b0200000023030000001f020000001f030000001f02000000230300000026020000002b0300000023020000001f030000001f020000001f030000002302000000
00100000395303952500000395300000000000345303452500000000003953039525395303952500000000003953039525000003c53000000000004053040525405304052500000000003c5303c5250000000000
001000003c5303c52500000355300000000000305303052500000000003053030525355303552500000000003553035525000003553000000000003953039525395303952500000000003c5303c5250000000000
001000003c5303c525000003753000000000003753037525000000000037530375253c5303c52500000000003c5303c525000004053000000000003753037525375303752500000000003c5303c5250000000000
001000003b5303b525000003e53000000000003b5303b52500000000003753037525375303752500000000003753037525000003753000000000003253032525325303252500000000002b5302b5250000000000
000c00000c340000000000018325000000000013335000000c340000000000000000000000000013335000000c340000000000018325000000000013335000000c34000000000000000000000000001333500000
000c00001334000000000001f32500000000001a335000001334000000000000000000000000001a335000001334000000000001f32500000000001a335000001334000000000000000000000000001a33500000
000c00001534000000000002132500000000001c335000001534000000000000000000000000001c335000001534000000000002132500000000001c335000001534000000000000000000000000001c33500000
000c00001134000000000001d3250000000000183350000011340000000000000000000000000018335000001134000000000001d325000000000018335000001134000000000000000000000000001833500000
000c00001f43000000244200000028430000002b4200000024430000001f420000001f430000001f42000000244300000028420000002b4300000024420000001f430000001f420000001f430000002442000000
000c00001f43000000234200000026430000002b4200000023430000001f420000001f430000001f42000000234300000026420000002b4300000023420000001f430000001f420000001f430000002342000000
000c00002143000000244200000028430000002d420000002443000000214200000021430000002142000000244300000028420000002d4300000024420000002143000000214200000021430000002442000000
000c00001d4300000021420000002443000000294200000021430000001d420000001d430000001d4200000021430000002442000000294300000021420000001d430000001d420000001d430000002142000000
000c000037230372253423034225342303422537230372253723037225000003c23000000000003c2303c2253c2303c2253c2303c225372303722537230372253723037225000003423000000000003023030225
000c00002f2302f2252f2302f2252b2302b2252b2302b2252b2302b225000002b23000000000002b2302b2252b2302b2252f2302f225322303222532230322253223032225000003223000000000003223032225
000c00003023030225342303422530230302253023030225302303022500000342300000000000342303422534230342253423034225392303922534230342253423034225000003923000000000003923039225
000c00003923039225352303522530230302252d2302d2252d2302d225000002d23000000000002d2302d2252d2302d2252d2302d225292302922529230292252923029225000002d23000000000003023030225
001400000e04000000000001a025000000000015035000000e040000000000000000000000000015035000000e04000000000001a025000000000015035000000e04000000000000000000000000001503500000
001400001604000000000002202500000000001d035000001604000000000000000000000000001d035000001604000000000002202500000000001d035000001604000000000000000000000000001d03500000
001400001104000000000001d0250000000000180350000011040000000000000000000000000018035000001104000000000001d025000000000018035000001104000000000000000000000000001803500000
001400001504000000000002102500000000001c035000001504000000000000000000000000001c035000001504000000000002102500000000001c035000001504000000000000000000000000001c03500000
001400001a730000001d72000000217300000026720000001d730000001a720000001a730000001a720000001d73000000217200000026730000001d720000001a730000001a720000001a730000001d72000000
001400001d7300000022720000002673000000297200000022730000001d720000001d730000001d7200000022730000002672000000297300000022720000001d730000001d720000001d730000002272000000
001400001d7300000021720000002473000000297200000021730000001d720000001d730000001d7200000021730000002472000000297300000021720000001d730000001d720000001d730000002172000000
001400001c7300000021720000002573000000287200000021730000001c720000001c730000001c7200000021730000002572000000287300000021720000001c730000001c720000001c730000002172000000
001400003203232025000000000000000000003503235025350323502500000000003903239025000000000039032390250000000000000000000035032350253503235025000000000000000000000000000000
001400003503235025000000000000000000003203232025320323202500000000002e0322e02500000000002e0322e0250000000000000000000029032290252903229025000000000000000000000000000000
001400002903229025000000000000000000002903229025290322902500000000002903229025000000000029032290250000000000000000000030032300253003230025000000000000000000000000000000
001400003103231025000000000000000000003403234025340323402500000000003903239025000000000039032390250000000000000000000034032340253403234025000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__music__
01 10141844
00 11151944
00 12161a44
02 13171b44
00 41424344
00 41424344
00 41424344
00 41424344
01 1c202444
00 1d212544
00 1e222644
02 1f232744
00 41424344
00 41424344
00 41424344
00 41424344
01 282c3044
00 292d3144
00 2a2e3244
02 2b2f3344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
00 41424344
