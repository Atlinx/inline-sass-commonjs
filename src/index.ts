import fs from 'fs';
import inlineCSS from 'inline-css';
import { HTMLElement, parse } from 'node-html-parser';
import os from 'os';
import path from 'path';
import sass from 'sass';

const defaultsOptions = {
  deleteTempDir: true
};

type MakeOptional<Type, Key extends keyof Type> = Omit<Type, Key> &
  Partial<Pick<Type, Key>>;

export type Options = MakeOptional<inlineCSS.Options, 'url'> & {
  deleteTempDir?: boolean;
};

const inlineSass = async (path_or_html: string, options: Options = {}) => {
  options = { ...defaultsOptions, ...options };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-'));

  const transpileSass = (dom: HTMLElement, base: string) => {
    const links = dom.querySelectorAll(
      'link[href$=".sass"],link[href$=".scss"]'
    );
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;
      let sassFile = href;
      if (base) {
        sassFile = path.join(base, sassFile);
      }
      let cssFile = path.join(
        tmp,
        path.basename(path.basename(href, '.sass'), '.scss') + '.css'
      );
      cssFile = cssFile.replace(/\\/g, '/');
      fs.writeFileSync(cssFile, sass.compile(sassFile).css);
      link.setAttribute('href', `file://${cssFile}`);
      link.setAttribute('data-original-href', href);
    }
    return dom;
  };

  let dir: string | undefined = undefined;
  if (options.url && options.url.search(/^file:\/\//) === 0)
    dir = options.url.replace(/^file:\/\//, '');

  let html = path_or_html;
  if (fs.existsSync(path_or_html)) {
    html = fs.readFileSync(path_or_html).toString();
    dir = path.dirname(path_or_html);
  }
  let dom = parse(html);

  if (!dom) {
    if (dir) {
      throw 'file "' + path_or_html + '" unparseable';
    } else {
      throw '"' + path_or_html + '" not HTML';
    }
  }

  dir = dir?.replace(/\\/g, '/');
  dom = transpileSass(
    dom,
    dir || (options.url?.replace(/(^\w+:\/\/)/, '') ?? '')
  );

  let result = undefined;
  try {
    result = await inlineCSS(String(dom), {
      url: `file://${dir}/`,
      ...options
    });
  } catch (e) {
    console.log(e);
  }

  if (options.deleteTempDir) {
    fs.rmdirSync(tmp, { recursive: true });
  } else {
    console.log(`Temp dir: ${tmp}`);
  }
  return result;
};

export default inlineSass;
