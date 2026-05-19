const SCRIPT = `(function(){try{
var t=localStorage.getItem('edificia-theme');
var valid=['editorial','plano','oscuro'];
if(valid.indexOf(t)===-1) t='editorial';
var r=document.documentElement;
r.setAttribute('data-theme',t);
if(t==='plano'||t==='oscuro') r.classList.add('dark');
}catch(e){document.documentElement.setAttribute('data-theme','editorial');}})();`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
