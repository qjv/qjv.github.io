#!/usr/bin/env python3
# fix_submodules.py

import configparser
import subprocess
import sys

GITHUB_USER = "qjv"

def main():
    config = configparser.ConfigParser()
    
    try:
        config.read('.gitmodules')
    except Exception as e:
        print(f"❌ Erro ao ler .gitmodules: {e}")
        sys.exit(1)
    
    if not config.sections():
        print("⚠️  Nenhum submodule encontrado em .gitmodules")
        sys.exit(0)
    
    print(f"🔍 Encontrados {len(config.sections())} submodules\n")
    
    for section in config.sections():
        if not section.startswith('submodule'):
            continue
        
        submodule_name = section.replace('submodule "', '').replace('"', '')
        path = config.get(section, 'path', fallback=None)
        current_url = config.get(section, 'url', fallback=None)
        
        if not path:
            print(f"⚠️  {submodule_name}: sem path definido")
            continue
        
        # Infere o nome do repo do path
        repo_name = path.split('/')[-1]
        new_url = f"https://github.com/{GITHUB_USER}/{repo_name}.git"
        
        print(f"📦 {submodule_name}")
        print(f"   Path: {path}")
        print(f"   Atual: {current_url or '(vazio)'}")
        print(f"   Nova: {new_url}")
        
        config.set(section, 'url', new_url)
        print("   ✅ Atualizado\n")
    
    # Salva
    with open('.gitmodules', 'w') as f:
        config.write(f, space_around_delimiters=False)
    
    print("💾 Arquivo .gitmodules atualizado!")
    print("\n🔄 Sincronizando...")
    
    try:
        subprocess.run(['git', 'submodule', 'sync', '--recursive'], check=True)
        print("✅ Sincronização completa!")
    except subprocess.CalledProcessError:
        print("⚠️  Erro ao sincronizar, faça manualmente: git submodule sync --recursive")

if __name__ == "__main__":
    main()