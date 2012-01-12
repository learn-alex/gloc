function GLOL() {
  function armor(meta,linkmap,fs_ct,opmac,s) {
    var intpatt = /GLOC_([0-9]+)/g;
    function f(s,n) {
      var anno = "";
      var fn = parseInt(n);
      if (linkmap[n]) {
	anno = "/* "+linkmap[n]+" */";
      }
      return (""+(fn+fs_ct)+anno);
    }
    s = s.replace(intpatt,f);

    var head = "";
    if (meta) {
      var authors="",license="",library="",version="",build="";
      function field(name,link) {
	return "// "+name+": "+link[0]+" <"+link[1]+">\n";
      }
      if (meta.authors) {
	for (var i=0; i < meta.authors.length; i++) {
	  authors += field("Author",meta.authors[i]);
	}
      }
      if (meta.license) license = field("License",meta.license);
      if (meta.library) library = field("Library",meta.library);
      if (meta.version) {
	var v = meta.version;
	version = "// Version: "+v[0]+"."+v[1]+"."+v[2]+"\n";
      }
      if (meta.build) build="// Build: "+meta.build+"\n";
      head = ("// Copyright "+meta.copyright[0]+" "
	      +meta.copyright[1][0]+" <"+meta.copyright[1][1]+"> "
	      +"All rights reserved.\n"+license+authors+library+version+build);
    }

    var undefs = "";
    for (var i = 0; i < opmac.length; i++) {
      undefs += "\n#undef "+opmac[i];
    }
    return head+s+undefs;
  }

  function satisfy_mac(addr, macro, glo_alist) {
    for (var i = 0; i < glo_alist.length; i++) {
      var name = glo_alist[i][0], glo = glo_alist[i][1];
      for (var u = 0; u < glo.units.length; u++) {
	var unit = glo.units[u];
	if (unit.outmac.indexOf(macro) != -1) return [name, u];
      }
    }
    throw (new MissingMacro(addr,macro));
  }

  function satisfy_sym(addr, sym, glo_alist) {
    for (var i = 0; i < glo_alist.length; i++) {
      var name = glo_alist[i][0], glo = glo_alist[i][1];
      for (var u = 0; u < glo.units.length; u++) {
	var unit = glo.units[u];
	if (unit.outmac.indexOf(sym) != -1 || unit.outsym.indexOf(sym) != -1) {
	  return [name, u];
	}
      }
    }
    throw (new MissingSymbol(addr, sym));
  }

  function map_of_list(v,l) {
    var m = {};
    for (var i = 0; i < l.length; i ++) m[l[i]]=v;
    return m;
  }

  function tooth(addr, u) {
    return {
      "rsym":u.insym, "rmac":u.inmac,
      "tsym":{}, "tmac":{},
      "bsym":map_of_list(addr,u.outsym), "bmac":map_of_list(addr,u.outmac),
      "addr":addr
    };
  }

  function assoc(key,alist) {
    for (var i = 0; i < alist.length; i++)
      if (alist[i][0] == key) return alist[i][1];
    throw (new NotFound(key));
  }

  function lookup(glo_alist,addr) {
    return assoc(addr[0],glo_alist).units[addr[1]];
  }

  function tooth_of_addr(glo_alist,addr) {
    return tooth(addr,lookup(glo_alist,addr));
  }

  function has_addr(addr,tooth) {
    return tooth.addr == addr;
  }

  function mergeb(b,top) {
    if (top.length == 0) return b;
    else {
      var zb = top[0];
      for (var k in zb.bsym) b.bsym[k] = zb.bsym[k];
      for (var k in zb.bmac) b.bmac[k] = zb.bmac[k];
      return b;
    }
  }

  function connect_mac(b,n,addr) {
    b.rmac=b.rmac.filter(function(m){ return m!=n; });
    b.tmac[n] = addr;
    return b;
  }

  function connect_sym(b,n,addr) {
    b.rsym=b.rsym.filter(function(m){ return m!=n; });
    b.tsym[n] = addr;
    return b;
  }

  function provided_mac(n,top) {
    if (top.length == 0) return null;
    else if (n in top[0].bmac) return top[0].bmac[n];
    else return null;
  }

  function provided_sym(n,top) {
    if (top.length == 0) return null;
    else if (n in top[0].bmac) return top[0].bmac[n];
    else if (n in top[0].bsym) return top[0].bsym[n];
    else return null;
  }

  function conflicted(tooth,top) {
    if (top.length == 0) return null;
    else {
      for (var key in tooth.bsym) {
	if (key in top[0].bsym) return [key, top[0].bsym[key]];
	if (key in top[0].bmac) return [key, top[0].bmac[key]];
      }
      for (var key in tooth.bmac) {
	if (key in top[0].bsym) return [key, top[0].bsym[key]];
	if (key in top[0].bmac) return [key, top[0].bmac[key]];
      }
    }
    return null;
  }

  function check_circdep(addr,zipper) {
    if (zipper[0].some(function (tooth){ return has_addr(addr,tooth); })) {
      throw (new CircularDependency(
	       zipper[0].map(function (t) { return t.addr; })));
    }
  }

  function check_conflicts(n,tooth,zipper) {
    var conflict = conflicted(tooth,zipper[1]);
    if (conflict != null) {
      throw (new SymbolConflict(n,conflict[0],addr,conflict[1]));
    }
  }

  // TODO: labelled loop + continue to avoid tail calls in TCO-less JS
  function satisfy_zipper(glo_alist,zipper) {
    if (zipper[0].length == 0) return zipper;
    else if (zipper[0][0].rmac.length != 0) {
      var b = zipper[0][0], n = b.rmac[0];
      var addr = provided_mac(n,zipper[1]);
      if (addr != null) {
	connect_mac(b,n,addr);
	return satisfy_zipper(glo_alist,zipper);
      }
      addr = satisfy_mac(b.addr,n,glo_alist);
      check_circdep(addr,zipper);
      var tooth = tooth_of_addr(glo_alist,addr);
      check_conflicts(n,tooth,zipper);
      connect_mac(b,n,addr);
      zipper[0].unshift(tooth);
      return satisfy_zipper(glo_alist,zipper);
    } else if (zipper[0][0].rsym.length != 0) {
      var b = zipper[0][0], n = b.rsym[0];
      var addr = provided_sym(n,zipper[1]);
      if (addr != null) {
	connect_sym(b,n,addr);
	return satisfy_zipper(glo_alist,zipper);
      }
      addr = satisfy_sym(b.addr,n,glo_alist);
      check_circdep(addr,zipper);
      var tooth = tooth_of_addr(glo_alist,addr);
      check_conflicts(n,tooth,zipper);
      connect_sym(b,n,addr);
      zipper[0].unshift(tooth);
      return satisfy_zipper(glo_alist,zipper);
    } else {
      var b = zipper[0].shift();
      zipper[1].unshift(mergeb(b,zipper[1]));
      return satisfy_zipper(glo_alist,zipper);
    }
  }

  function sort(reqsym,glo_alist) {
    var addrs = reqsym.reduce(function (al,sym) {
      var addr = satisfy_sym(["<-u "+sym+">",0],sym,glo_alist);
      if (al.every(function (a) { return a[0]!=addr[0] || a[1]!=addr[1]; })) {
	al.push(addr);
      }
      return al;
    },[]);
    var zipper = [addrs.map(function (addr) {
			      return tooth_of_addr(glo_alist,addr);
			    }),[]];
    zipper = satisfy_zipper(glo_alist,zipper);
    return zipper[1].reduce(function (al,tooth) {
			      al.unshift(tooth.addr);
			      return al;
			    },[]);
  }

  function preamble(glol) {
    var b_order = ["require","warn","enable","disable"];
    function b_max(x,y) {
      return b_order[Math.min(b_order.indexOf(x),b_order.indexOf(y))];
    }
    function ext_merge(addr,m,ext) {
      if (ext[0] in m) {
	m[ext[0]] = b_max(ext[1],m[ext[0]]); return m;
      } else if (ext[1] in b_order) {
	m[ext[0]] = ext[1]; return m;
      } else throw (new UnknownBehavior(addr,ext[1]));
    }
    function ext_decl(ext,b) { return "#extension "+ext+" : "+b+"\n"; }
    function ext_segment(m) {
      var exts = "";
      for (var e in m) if (e!="all") exts += ext_decl(e,m[e]);
      return ((("all" in m)?ext_decl("all",m.all):"")+exts);
    }
    var preamble = glol.reduce(function(pre,gap) {
      var u = gap[1].units[gap[0][1]];
      return [u.vdir==null?pre[0]
	      :(pre[0]==null?u.vdir
		:Math.max(u.vdir,pre[0])),
	      u.pdir.reduce(function(p,s) { return p+s+"\n"; },pre[1]),
	      u.edir.reduce(function(m,ext) {
			      return ext_merge(gap[0],m,ext);
			    },pre[2])
	     ];
      },[null,"",{}]);
    return (((preamble[0]!=null)?("#version "+preamble[0]+"\n"):"")
	    +preamble[1]+(ext_segment(preamble[2])));
  }

  function flatten(prefix,glom) {
    return glom.reduce(function(glo_alist,ngp) {
      if (Array.isArray(ngp[1]))
	return glo_alist.concat(flatten(prefix+ngp[0]+"/",ngp[1]));
      else return glo_alist.concat([[prefix+ngp[0],ngp[1]]]);
    },[]);
  }

  function filter(alist) {
    var l = [];
    for (var i = 0; i < alist.length; i++) {
      var glo = alist[1][1];
      if (glo.glo) {
	if (glo.glo[0] != 0 || glo.glo[1] != 1) {
	  throw (new UnknownGloVersion(alist[i][0],glo.glo));
	}
	l.push(alist[i]);
      }
    }
    return l;
  }

  function add_zero(o,f,z) { if (!(f in o)) { o[f] = z; } return o; }

  function add_zeros(alist) {
    return alist.map(function (ngp) {
      var name = ngp[0], glo = ngp[1];
      add_zero(glo,"units",[]);
      add_zero(glo,"linkmap",{});
      glo.units = glo.units.map(function (u) {
	add_zero(u,"pdir",[]); add_zero(u,"edir",[]);
	add_zero(u,"insym",[]);	add_zero(u,"outsym",[]);
	add_zero(u,"inmac",[]);	add_zero(u,"opmac",[]);	add_zero(u,"outmac",[]);
	return u;
      });
      return [name,glo];
    });
  }

  this.link = function(prologue,reqsym,glom) {
    var glo_alist = add_zeros(filter(flatten("",glom)));
    var glol = (sort(reqsym,glo_alist)).map(function (addr) {
      return [addr,assoc(addr[0],glo_alist)];
    });
    return glol.reduce(function (acc,agp) {
      var sup = 0, glo = agp[1], name=agp[0][0], src=acc[0],
	  pname=acc[1][0], o=acc[1][1];
      for (var k in glo.linkmap) { sup = Math.max(sup,parseInt(k)); }
      var u = glo.units[agp[0][1]];
      return [(src+armor(name==pname?null:glo.meta,
			glo.linkmap,o,u.opmac,u.source)),
	      [name,o+sup+1]];
    }, [preamble(glol)+prologue,["",0]])[0];
  };
}