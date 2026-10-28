const { createApp } = Vue;

// Inicializar Supabase (usando la URL raíz del proyecto)
const SUPABASE_URL = 'https://dplsiqpbxozueacfnvfw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_r7vdvy6_I1jm17ALirWUdA_0NxnZH_7';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.addEventListener('DOMContentLoaded', () => {
  const savedData = localStorage.getItem('myApp_data');
  if (savedData) {
    const data = JSON.parse(savedData);
    console.log('Data loaded on refresh:', data);
  }
});

createApp({

  mounted() {
    this.checkUserSession();
    this.fetchAllData();
  },
  
  data() {
    return {
      sidebarOpen: true,
      currentView: 'characters',

      // Autenticación
      currentUser: null,
      loginModalVisible: false,
      loginForm: {
        username: '',
        password: ''
      },

      newFranchise: {
      id: '',
      name: '',
      image: '',
      pendingFiles: [] // Almacenará temporalmente el archivo optimizado
      },

      franchiseFormModalVisible: false, // Controla la apertura del modal del formulario
      newFranchise: this.getEmptyFranchiseObject(),

      outfitMixers: JSON.parse(localStorage.getItem('wiki_outfitMixers')) || [],
      isEditingOutfitMixer: false,
      newOutfitMixer: this.getEmptyOutfitMixerObject(),

      maps: [],
      isEditingMap: false,
      newMap: this.getEmptyMapObject(),
      
      generalMods: [],
      isEditingGeneralMod: false,
      newGeneralMod: this.getEmptyGeneralModObject(),
      searchQuery: '',

      characterSelectorVisible: false,
      selectorSearchQuery: '',

      franchiseFilter: '',
      themeFilter: '',
      hairFilter: '',
      eyesFilter: '',
      genderFilter: '',
      skinFilter: '',
      bustFilter: '',
      bodyTypeFilter: '',

      genderOptions: ['Femenine', 'Masculine'],

      characters: [],

      characterModalVisible: false,
      franchiseModalVisible: false,
      selectedCharacter: null,
      selectedFranchise: '',
      activeImage: '',

      isEditing: false,
      fileHandle: null,

      newChar: this.getEmptyCharacterObject()
    };
  },

  computed: {
    hasActiveFilters() {
      return (
        this.franchiseFilter ||
        this.themeFilter ||
        this.hairFilter ||
        this.eyesFilter ||
        this.genderFilter ||
        this.skinFilter ||
        this.bustFilter ||
        this.bodyTypeFilter ||
        this.searchQuery
      );
    },

    searchPlaceholder() {
      if (this.currentView === 'generalMods') return 'Search game mods by name, creator, description...';
      if (this.currentView === 'maps') return 'Search maps by name, creator...';
      if (this.currentView === 'franchises') return 'Search franchises...';
      return 'Search character, alias, franchise, clothing...';
    },

    filteredGeneralMods() {
      if (!this.searchQuery) return this.generalMods;
      const q = this.searchQuery.toLowerCase().trim();
      return this.generalMods.filter(m => 
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.modCreator && m.modCreator.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    },

    filteredMaps() {
      if (!this.searchQuery) return this.maps;
      const q = this.searchQuery.toLowerCase().trim();
      return this.maps.filter(map => 
        (map.name && map.name.toLowerCase().includes(q)) ||
        (map.modCreator && map.modCreator.toLowerCase().includes(q))
      );
    },

    filteredCharacters() {
      return this.characters
        .filter(p => {
          const matchesSearch = this.globalSearchMatch(p, this.searchQuery);
          const matchesFranchise = !this.franchiseFilter || (
            Array.isArray(p.franchise) 
              ? p.franchise.includes(this.franchiseFilter) 
              : p.franchise === this.franchiseFilter
          );
          const matchesTheme = !this.themeFilter || (
            Array.isArray(p.theme) 
              ? p.theme.includes(this.themeFilter) 
              : p.theme === this.themeFilter
          );
          const matchesHair = !this.hairFilter || p.physical?.hair === this.hairFilter;
          const matchesEyes = !this.eyesFilter || p.physical?.eyes === this.eyesFilter;
          const matchesGender = !this.genderFilter || (p.gender && p.gender.toLowerCase() === this.genderFilter.toLowerCase());
          const matchesSkin = !this.skinFilter || p.physical?.skin === this.skinFilter;
          const matchesBust = !this.bustFilter || p.physical?.bustSize === this.bustFilter;
          const matchesBodyType = !this.bodyTypeFilter || p.physical?.bodyType === this.bodyTypeFilter;

          return matchesSearch && matchesFranchise && matchesTheme && matchesHair && matchesEyes && matchesGender && matchesSkin && matchesBust && matchesBodyType;
        })
        .sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });
    },

    uniqueFranchises() {
      const franchises = this.characters.flatMap(p => 
        Array.isArray(p.franchise) ? p.franchise : [p.franchise]
      ).filter(Boolean);
      return [...new Set(franchises)]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    },
    uniqueThemes() {
      const themes = this.characters.flatMap(p => 
        Array.isArray(p.theme) ? p.theme : [p.theme]
      ).filter(Boolean);
      return [...new Set(themes)];
    },
    uniqueCreators() {
      return [...new Set(this.characters.map(p => p.modelCreator).filter(Boolean))];
    },
    uniqueOccupations() {
      const occupations = this.characters.flatMap(p => 
        Array.isArray(p.occupation) ? p.occupation : [p.occupation]
      ).filter(Boolean);
      return [...new Set(occupations)];
    },
    uniqueHeights() {
      return [...new Set(this.characters.map(p => p.physical?.height).filter(Boolean))];
    },
    uniqueHairColors() {
      return [...new Set(this.characters.map(p => p.physical?.hair).filter(Boolean))];
    },
    uniqueSkinTones() {
      return [...new Set(this.characters.map(p => p.physical?.skin).filter(Boolean))];
    },
    uniqueEyeColors() {
      return [...new Set(this.characters.map(p => p.physical?.eyes).filter(Boolean))];
    },
    uniqueBustSizes() {
      return [...new Set(this.characters.map(p => p.physical?.bustSize).filter(Boolean))];
    },
    uniqueBodyTypes() {
      return [...new Set(this.characters.map(p => p.physical?.bodyType).filter(Boolean))];
    },
    uniqueGenders() {
      const existingGenders = this.characters.map(p => p.gender).filter(Boolean);
      return [...new Set([...this.genderOptions, ...existingGenders])];
    },

    franchiseList() {
    return this.franchises.map(franchise => ({
      id: franchise.id,
      name: franchise.name,
      // Si la franquicia tiene una URL de Supabase la usa, de lo contrario deja un string vacío o una imagen por defecto
      banner: franchise.image || '' 
    }));
  },

    franchiseCharacters() {
      return this.characters
        .filter(p => {
          const franchises = Array.isArray(p.franchise) ? p.franchise : [p.franchise];
          return franchises.includes(this.selectedFranchise);
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    }
  },

  methods: {
    getEmptyCharacterObject() {
      return {
        id: '',
        name: '',
        alias: '',
        gender: '',
        modelCreator: '',
        franchise: [''],
        theme: [''],
        occupation: [''],
        isMod: false,
        modCreator: '',
        modDownloadUrl: '',
        relatedCharacterId: '',
        physical: {
          height: '',
          hair: '',
          skin: '',
          eyes: '',
          bustSize: '',
          bodyType: ''
        },
        wardrobe: [''],
        images: [''],
        popularMods: [
          { name: '', modCreator: '', url: '', image: '' }
        ]
      };
    },

    getEmptyFranchiseObject() {
  return {
    id: '',
    name: '',
    image: '',
    pendingFiles: []
  };
},

// Abrir y cerrar el modal del formulario
openNewFranchiseModal() {
  this.newFranchise = this.getEmptyFranchiseObject();
  this.franchiseFormModalVisible = true;
},

closeNewFranchiseModal() {
  this.franchiseFormModalVisible = false;
  this.newFranchise = this.getEmptyFranchiseObject();
},

    async fetchFranchises() {
  const { data, error } = await supabaseClient
    .from('franchises')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching franchises:', error);
  } else if (data) {
    // Sobrescribimos el arreglo local con los datos de Supabase
    this.franchises = data; 
  }
},


extractStoragePath(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const marker = '/wiki-images/';
  const parts = publicUrl.split(marker);
  if (parts.length > 1) {
    return parts[1]; // Retorna algo como 'characters/1689234-abc.jpg'
  }
  return null;
},

    async attachFranchiseImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 1. Optimizar usando la función que ya creamos antes (<200 KB)
  const optimizedFile = await this.optimizeImageFile(file);
  
  // 2. Generar vista previa temporal en el navegador
  const previewUrl = URL.createObjectURL(optimizedFile);

  this.newFranchise.image = previewUrl;
  
  // 3. Guardar en pendientes para subirlo solo al hacer clic en Guardar
  this.newFranchise.pendingFiles = [{
    file: optimizedFile
  }];

  event.target.value = '';
},

async saveFranchise() {
  // 1. Subir la imagen pendiente si existe
  if (this.newFranchise.pendingFiles && this.newFranchise.pendingFiles.length > 0) {
    const item = this.newFranchise.pendingFiles[0];
    const publicUrl = await this.uploadImageToSupabase(item.file, 'franchises');
    if (publicUrl) {
      this.newFranchise.image = publicUrl;
    }
    delete this.newFranchise.pendingFiles;
  }

  this.newFranchise.name = this.newFranchise.name.trim();

  // 2. Preparamos el payload (si es nuevo, omitimos el ID para que Supabase lo genere)
  const payload = {
    name: this.newFranchise.name,
    image: this.newFranchise.image
  };

  // Si ya tienes un ID existente (en caso de edición futura), lo incluyes
  if (this.newFranchise.id) {
    payload.id = this.newFranchise.id;
  }

  const { error } = await supabaseClient.from('franchises').upsert(payload);

  if (error) {
    alert('Error saving franchise: ' + error.message);
  } else {
    alert('Franchise saved successfully to cloud!');
    await this.fetchFranchises();
    this.closeNewFranchiseModal();
  }
},

async deleteFranchise(id) {
  if (confirm('Are you sure you want to delete this franchise?')) {
    
    // 1. Encontrar la franquicia para obtener la URL de su imagen en Supabase
    const franchiseToDelete = this.franchises.find(f => f.id === id);

    if (franchiseToDelete && franchiseToDelete.image) {
      const path = this.extractStoragePath(franchiseToDelete.image);
      
      // 2. Borrar el archivo físico de la carpeta 'franchises' en el Storage
      if (path) {
        const { error: storageError } = await supabaseClient.storage
          .from('wiki-images')
          .remove([path]);
          
        if (storageError) {
          console.error('Error deleting franchise image from storage:', storageError.message);
        }
      }
    }

    // 3. Borrar el registro de la tabla 'franchises' en Supabase
    const { error } = await supabaseClient.from('franchises').delete().eq('id', id);
    
    if (error) {
      alert('Error deleting franchise: ' + error.message);
    } else {
      alert('Franchise deleted successfully!');
      await this.fetchFranchises();
    }
  }
},

removeFranchiseImage() {
  this.newFranchise.image = '';
  this.newFranchise.pendingFiles = [];
},

    async uploadImageToSupabase(file, folder = 'characters') {
      try {
        const maxSizeInBytes = 200 * 1024;
        if (file.size > maxSizeInBytes) {
          console.warn(`La imagen pesa ${(file.size / 1024).toFixed(1)} KB (supera el límite ideal de 200 KB).`);
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        const { data, error } = await supabaseClient.storage
          .from('wiki-images')
          .upload(filePath, file);

        if (error) throw error;

        const { data: publicURLData } = supabaseClient.storage
          .from('wiki-images')
          .getPublicUrl(filePath);

        return publicURLData.publicUrl;
      } catch (err) {
        alert('Error al subir la imagen: ' + err.message);
        return null;
      }
    },

    // Redimensionar y comprimir imagen en el cliente para que pese menos de 200KB
    async optimizeImageFile(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Definir un límite máximo de resolución inicial (ej. 1200px) para acelerar
            const MAX_DIMENSION = 1200;
            if (width > height && width > MAX_DIMENSION) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else if (height > MAX_DIMENSION) {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Empezar con una calidad alta y reducir recursivamente si pesa > 200KB
            let quality = 0.85;
            const targetSize = 200 * 1024; // 200 KB

            const attemptCompress = () => {
              canvas.toBlob((blob) => {
                if (blob.size > targetSize && quality > 0.3) {
                  quality -= 0.15;
                  attemptCompress();
                } else {
                  // Crear un nuevo archivo optimizado listo para subir
                  const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(optimizedFile);
                }
              }, 'image/jpeg', quality);
            };

            attemptCompress();
          };
        };
      });
    },

    async fetchAllData() {
  await Promise.all([
    this.fetchCharacters(),
    this.fetchGeneralMods(),
    this.fetchMaps(),
    this.fetchFranchises()
  ]);
},

    async fetchCharacters() {
      const { data, error } = await supabaseClient
        .from('characters')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching characters:', error);
      } else if (data) {
        this.characters = data.map(c => ({
          id: c.id,
          name: c.name,
          alias: c.alias,
          gender: c.gender,
          modelCreator: c.model_creator,
          franchise: c.franchise || [''],
          theme: c.theme || [''],
          occupation: c.occupation || [''],
          isMod: c.is_mod,
          modCreator: c.mod_creator,
          modDownloadUrl: c.mod_download_url,
          relatedCharacterId: c.related_character_id,
          physical: c.physical || {},
          wardrobe: c.wardrobe || [''],
          images: c.images || [''],
          popularMods: c.popular_mods || []
        }));
      }
    },

    async fetchGeneralMods() {
      const { data, error } = await supabaseClient
        .from('general_mods')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching general mods:', error);
      } else if (data) {
        this.generalMods = data.map(m => ({
          id: m.id,
          name: m.name,
          modCreator: m.mod_creator,
          description: m.description,
          sameDownloadUrl: m.same_download_url,
          globalUrl: m.global_url,
          changelog: m.changelog || [],
          images: m.images || ['']
        }));
      }
    },

    async fetchMaps() {
      const { data, error } = await supabaseClient
        .from('maps')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching maps:', error);
      } else if (data) {
        this.maps = data.map(m => ({
          id: m.id,
          name: m.name,
          isMod: m.is_mod,
          modCreator: m.mod_creator,
          url: m.url,
          images: m.images || ['']
        }));
      }
    },

    openLoginModal() {
      this.loginForm = { username: '', password: '' };
      this.loginModalVisible = true;
    },
    closeLoginModal() {
      this.loginModalVisible = false;
    },
    async login() {
      const email = `${this.loginForm.username.trim().toLowerCase()}@wiki.internal`;
      const password = this.loginForm.password;

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        alert('Error al iniciar sesión: ' + error.message);
      } else {
        this.currentUser = data.user;
        this.closeLoginModal();
        alert('¡Bienvenido, editor!');
      }
    },
    async logout() {
      const { error } = await supabaseClient.auth.signOut();
      if (!error) {
        this.currentUser = null;
        alert('Sesión cerrada correctamente.');
      }
    },
    async checkUserSession() {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        this.currentUser = session.user;
      }
    },

    getEmptyMapObject() {
      return {
        id: '',
        name: '',
        isMod: false,
        modCreator: '',
        url: '',
        images: ['']
      };
    },

    openNewMapForm() {
      this.isEditingMap = false;
      this.newMap = this.getEmptyMapObject();
      this.currentView = 'captureMap';
    },

    openEditMapForm(map) {
      this.isEditingMap = true;
      this.newMap = JSON.parse(JSON.stringify(map));
      if (this.newMap.isMod === undefined) this.newMap.isMod = false;
      if (!this.newMap.modCreator) this.newMap.modCreator = '';
      if (!this.newMap.images || this.newMap.images.length === 0) {
        this.newMap.images = [''];
      }
      this.currentView = 'captureMap';
    },

    addMapImageField() {
      this.newMap.images.push('');
    },

    removeMapImageField(index) {
      this.newMap.images.splice(index, 1);
      if (this.newMap.images.length === 0) {
        this.newMap.images.push('');
      }
    },

    async attachMapImages(event) {
      const files = Array.from(event.target.files);
      if (!files.length) return;

      if (!this.newMap.pendingFiles) {
        this.newMap.pendingFiles = [];
      }

      if (this.newMap.images.length === 1 && this.newMap.images[0] === '') {
        this.newMap.images = [];
      }

      for (const file of files) {
        const optimizedFile = await this.optimizeImageFile(file);
        const previewUrl = URL.createObjectURL(optimizedFile);

        this.newMap.images.push(previewUrl);
        this.newMap.pendingFiles.push({
          index: this.newMap.images.length - 1,
          file: optimizedFile
        });
      }

      event.target.value = '';
    },

    async saveMap() {
      // Subir imágenes pendientes a la carpeta 'maps'
      if (this.newMap.pendingFiles && this.newMap.pendingFiles.length > 0) {
        for (const item of this.newMap.pendingFiles) {
          const publicUrl = await this.uploadImageToSupabase(item.file, 'maps');
          if (publicUrl) {
            this.newMap.images[item.index] = publicUrl;
          }
        }
        delete this.newMap.pendingFiles;
      }

      if (!this.newMap.isMod) this.newMap.url = '';
      this.newMap.images = this.newMap.images.map(i => i.trim()).filter(Boolean);
      if (this.newMap.images.length === 0) this.newMap.images = [''];

      if (!this.isEditingMap) {
        this.newMap.id = 'map-' + Date.now();
      }

      const payload = {
        id: this.newMap.id,
        name: this.newMap.name,
        is_mod: this.newMap.isMod,
        mod_creator: this.newMap.modCreator,
        url: this.newMap.url,
        images: this.newMap.images
      };

      const { error } = await supabaseClient.from('maps').upsert(payload);

      if (error) {
        alert('Error saving map: ' + error.message);
      } else {
        alert('Map saved successfully!');
        await this.fetchMaps();
        this.openNewMapForm();
        this.currentView = 'maps';
      }
    },

    async deleteMap(id) {
  if (confirm('Are you sure you want to delete this map?')) {
    
    // 1. Encontrar el mapa en la lista actual para acceder a sus imágenes
    const mapToDelete = this.maps.find(m => m.id === id);

    if (mapToDelete && mapToDelete.images) {
      const pathsToDelete = [];

      // Recolectar rutas de las imágenes del mapa
      mapToDelete.images.forEach(url => {
        const path = this.extractStoragePath(url);
        if (path) pathsToDelete.push(path);
      });

      // Borrar los archivos del Storage si hay rutas válidas
      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabaseClient.storage
          .from('wiki-images')
          .remove(pathsToDelete);
          
        if (storageError) {
          console.error('Error deleting map images from storage:', storageError.message);
        }
      }
    }

    // 2. Borrar el registro del mapa en la tabla de Supabase
    const { error } = await supabaseClient.from('maps').delete().eq('id', id);
    
    if (error) {
      alert('Error deleting map: ' + error.message);
    } else {
      alert('Map deleted successfully!');
      await this.fetchMaps();
    }
  }
},

    getEmptyGeneralModObject() {
      return {
        id: '',
        name: '',
        modCreator: '',
        description: '',
        sameDownloadUrl: false,
        globalUrl: '',
        changelog: [
          { publishDate: '', version: '', patchNotes: '', url: '' }
        ],
        images: ['']
      };
    },

    openNewGeneralModForm() {
      this.isEditingGeneralMod = false;
      this.newGeneralMod = this.getEmptyGeneralModObject();
      this.currentView = 'captureGeneralMod';
    },

    openEditGeneralModForm(mod) {
      this.isEditingGeneralMod = true;
      this.newGeneralMod = JSON.parse(JSON.stringify(mod));
      if (!this.newGeneralMod.modCreator) this.newGeneralMod.modCreator = '';
      if (this.newGeneralMod.sameDownloadUrl === undefined) this.newGeneralMod.sameDownloadUrl = false;
      if (!this.newGeneralMod.globalUrl) this.newGeneralMod.globalUrl = this.newGeneralMod.url || '';

      if (!this.newGeneralMod.changelog || this.newGeneralMod.changelog.length === 0) {
        this.newGeneralMod.changelog = [
          { publishDate: '', version: '1.0', patchNotes: '', url: this.newGeneralMod.url || '' }
        ];
      }

      if (!this.newGeneralMod.images || this.newGeneralMod.images.length === 0) {
        this.newGeneralMod.images = [''];
      }
      this.currentView = 'captureGeneralMod';
    },

    addGeneralModChangelogField() {
      if (!this.newGeneralMod.changelog) this.newGeneralMod.changelog = [];
      this.newGeneralMod.changelog.push({ publishDate: '', version: '', patchNotes: '', url: '' });
    },

    removeGeneralModChangelogField(index) {
      this.newGeneralMod.changelog.splice(index, 1);
      if (this.newGeneralMod.changelog.length === 0) {
        this.newGeneralMod.changelog.push({ publishDate: '', version: '', patchNotes: '', url: '' });
      }
    },

    addGeneralModImageField() {
      this.newGeneralMod.images.push('');
    },

    removeGeneralModImageField(index) {
      this.newGeneralMod.images.splice(index, 1);
      if (this.newGeneralMod.images.length === 0) {
        this.newGeneralMod.images.push('');
      }
    },

    async attachGeneralModImages(event) {
      const files = Array.from(event.target.files);
      if (!files.length) return;

      if (!this.newGeneralMod.pendingFiles) {
        this.newGeneralMod.pendingFiles = [];
      }

      if (this.newGeneralMod.images.length === 1 && this.newGeneralMod.images[0] === '') {
        this.newGeneralMod.images = [];
      }

      for (const file of files) {
        const optimizedFile = await this.optimizeImageFile(file);
        const previewUrl = URL.createObjectURL(optimizedFile);

        this.newGeneralMod.images.push(previewUrl);
        this.newGeneralMod.pendingFiles.push({
          index: this.newGeneralMod.images.length - 1,
          file: optimizedFile
        });
      }

      event.target.value = '';
    },

    async saveGeneralMod() {
      // Subir imágenes pendientes a la carpeta 'general-mods'
      if (this.newGeneralMod.pendingFiles && this.newGeneralMod.pendingFiles.length > 0) {
        for (const item of this.newGeneralMod.pendingFiles) {
          const publicUrl = await this.uploadImageToSupabase(item.file, 'general-mods');
          if (publicUrl) {
            this.newGeneralMod.images[item.index] = publicUrl;
          }
        }
        delete this.newGeneralMod.pendingFiles;
      }

      this.newGeneralMod.images = this.newGeneralMod.images.map(i => i.trim()).filter(Boolean);
      if (this.newGeneralMod.images.length === 0) this.newGeneralMod.images = [''];

      if (!this.isEditingGeneralMod) {
        this.newGeneralMod.id = 'gmod-' + Date.now();
      }

      const payload = {
        id: this.newGeneralMod.id,
        name: this.newGeneralMod.name,
        mod_creator: this.newGeneralMod.modCreator,
        description: this.newGeneralMod.description,
        same_download_url: this.newGeneralMod.sameDownloadUrl,
        global_url: this.newGeneralMod.globalUrl,
        changelog: this.newGeneralMod.changelog,
        images: this.newGeneralMod.images
      };

      const { error } = await supabaseClient.from('general_mods').upsert(payload);

      if (error) {
        alert('Error saving mod: ' + error.message);
      } else {
        alert('General Mod saved successfully!');
        await this.fetchGeneralMods();
        this.openNewGeneralModForm();
        this.currentView = 'generalMods';
      }
    },

    async deleteGeneralMod(id) {
  if (confirm('Are you sure you want to delete this general mod?')) {
    
    // 1. Encontrar el mod general en la lista actual para acceder a sus imágenes
    const modToDelete = this.generalMods.find(m => m.id === id);

    if (modToDelete && modToDelete.images) {
      const pathsToDelete = [];

      // Recolectar rutas de las imágenes del mod general
      modToDelete.images.forEach(url => {
        const path = this.extractStoragePath(url);
        if (path) pathsToDelete.push(path);
      });

      // Borrar los archivos del Storage si hay rutas válidas
      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabaseClient.storage
          .from('wiki-images')
          .remove(pathsToDelete);
          
        if (storageError) {
          console.error('Error deleting general mod images from storage:', storageError.message);
        }
      }
    }

    // 2. Borrar el registro del mod general en la tabla de Supabase
    const { error } = await supabaseClient.from('general_mods').delete().eq('id', id);
    
    if (error) {
      alert('Error deleting mod: ' + error.message);
    } else {
      await this.fetchGeneralMods();
    }
  }
},

    getEmptyOutfitMixerObject() {
      return {
        id: '',
        name: '',
        code: '',
        images: ['']
      };
    },

    openNewOutfitMixerForm() {
      this.isEditingOutfitMixer = false;
      this.newOutfitMixer = this.getEmptyOutfitMixerObject();
      this.currentView = 'captureOutfitMixer';
    },

    openEditOutfitMixerForm(item) {
      this.isEditingOutfitMixer = true;
      this.newOutfitMixer = JSON.parse(JSON.stringify(item));
      if (!this.newOutfitMixer.images || this.newOutfitMixer.images.length === 0) {
        this.newOutfitMixer.images = [''];
      }
      this.currentView = 'captureOutfitMixer';
    },

    addOutfitMixerImageField() {
      this.newOutfitMixer.images.push('');
    },

    removeOutfitMixerImageField(index) {
      this.newOutfitMixer.images.splice(index, 1);
      if (this.newOutfitMixer.images.length === 0) {
        this.newOutfitMixer.images.push('');
      }
    },

    attachOutfitMixerImages(event) {
      const files = Array.from(event.target.files);
      if (!files.length) return;

      if (this.newOutfitMixer.images.length === 1 && this.newOutfitMixer.images[0] === '') {
        this.newOutfitMixer.images = [];
      }

      files.forEach(file => {
        this.newOutfitMixer.images.push(`img/Outfit Mixer/${file.name}`);
      });

      event.target.value = '';
    },

    saveOutfitMixer() {
      this.newOutfitMixer.images = this.newOutfitMixer.images.map(i => i.trim()).filter(Boolean);
      if (this.newOutfitMixer.images.length === 0) this.newOutfitMixer.images = [''];

      if (this.isEditingOutfitMixer) {
        const index = this.outfitMixers.findIndex(m => m.id === this.newOutfitMixer.id);
        if (index !== -1) {
          this.outfitMixers[index] = { ...this.newOutfitMixer };
        }
        alert('Outfit Mixer updated successfully!');
      } else {
        this.newOutfitMixer.id = 'omix-' + Date.now();
        this.outfitMixers.push({ ...this.newOutfitMixer });
        alert('Outfit Mixer registered successfully!');
      }

      localStorage.setItem('wiki_outfitMixers', JSON.stringify(this.outfitMixers));
      this.openNewOutfitMixerForm();
      this.currentView = 'outfitMixer';
    },

    deleteOutfitMixer(id) {
      if (confirm('Are you sure you want to delete this item?')) {
        this.outfitMixers = this.outfitMixers.filter(m => m.id !== id);
        localStorage.setItem('wiki_outfitMixers', JSON.stringify(this.outfitMixers));
      }
    },

    openCharacterSelector() {
      this.selectorSearchQuery = '';
      this.characterSelectorVisible = true;
    },
    closeCharacterSelector() {
      this.characterSelectorVisible = false;
    },
    selectRelatedCharacter(char) {
      this.newChar.relatedCharacterId = char.id;
      this.closeCharacterSelector();
    },
    removeRelatedCharacter() {
      this.newChar.relatedCharacterId = '';
    },
    getCharacterById(id) {
      return this.characters.find(c => c.id === id) || null;
    },

    addFranchiseField() {
      this.newChar.franchise.push('');
    },
    removeFranchiseField(index) {
      this.newChar.franchise.splice(index, 1);
      if (this.newChar.franchise.length === 0) {
        this.newChar.franchise.push('');
      }
    },

    addThemeField() {
      this.newChar.theme.push('');
    },
    removeThemeField(index) {
      this.newChar.theme.splice(index, 1);
      if (this.newChar.theme.length === 0) {
        this.newChar.theme.push('');
      }
    },
    addOccupationField() {
      this.newChar.occupation.push('');
    },
    removeOccupationField(index) {
      this.newChar.occupation.splice(index, 1);
      if (this.newChar.occupation.length === 0) {
        this.newChar.occupation.push('');
      }
    },

    addOutfitField() {
      this.newChar.wardrobe.push('');
    },
    removeOutfitField(index) {
      this.newChar.wardrobe.splice(index, 1);
      if (this.newChar.wardrobe.length === 0) {
        this.newChar.wardrobe.push('');
      }
    },
    handleOutfitEnter(index) {
      if (this.newChar.wardrobe[index].trim() !== '') {
        this.addOutfitField();
        this.$nextTick(() => {
          const inputs = document.querySelectorAll('.vista-captura .fila-dinamica input');
          if (inputs[index + 1]) {
            inputs[index + 1].focus();
          }
        });
      }
    },

    addModField() {
      this.newChar.popularMods.push({ name: '', modCreator: '', url: '', image: '' });
    },
    removeModField(index) {
      this.newChar.popularMods.splice(index, 1);
      if (this.newChar.popularMods.length === 0) {
        this.newChar.popularMods.push({ name: '', modCreator: '', url: '', image: '' });
      }
    },
    async attachModImage(event, index) {
      const file = event.target.files[0];
      if (!file) return;

      const optimizedFile = await this.optimizeImageFile(file);
      const previewUrl = URL.createObjectURL(optimizedFile);

      // Asignar vista previa temporal
      this.newChar.popularMods[index].image = previewUrl;

      // Registrar archivo pendiente de subida
      if (!this.newChar.pendingModFiles) {
        this.newChar.pendingModFiles = [];
      }
      this.newChar.pendingModFiles.push({
        index: index,
        file: optimizedFile
      });

      event.target.value = '';
    },

    globalSearchMatch(character, term) {
      if (!term) return true;
      const q = term.toLowerCase().trim();

      const extractText = (obj) => {
        let textList = [];
        for (const key in obj) {
          if (!obj.hasOwnProperty(key)) continue;
          if (key === 'images' || key === 'banner') continue;

          const val = obj[key];
          if (typeof val === 'string' || typeof val === 'number') {
            textList.push(val.toString().toLowerCase());
          } else if (Array.isArray(val)) {
            val.forEach(item => {
              if (typeof item === 'object') {
                textList.push(...extractText(item));
              } else if (item) {
                textList.push(item.toString().toLowerCase());
              }
            });
          } else if (typeof val === 'object' && val !== null) {
            textList.push(...extractText(val));
          }
        }
        return textList;
      };

      const allText = extractText(character);
      return allText.some(text => text.includes(q));
    },

    clearFilters() {
      this.franchiseFilter = '';
      this.themeFilter = '';
      this.hairFilter = '';
      this.eyesFilter = '';
      this.genderFilter = '';
      this.skinFilter = '';
      this.bustFilter = '';
      this.bodyTypeFilter = '';
      this.searchQuery = '';
    },

    openNewCharacterForm() {
      this.isEditing = false;
      this.newChar = this.getEmptyCharacterObject();
      this.currentView = 'capture';
    },

    openEditCharacterForm(character) {
      this.isEditing = true;
      this.closeCharacterModal();

      this.newChar = JSON.parse(JSON.stringify(character));

      if (this.newChar.isMod === undefined) this.newChar.isMod = false;
      if (!this.newChar.modCreator) this.newChar.modCreator = '';
      if (!this.newChar.modDownloadUrl) this.newChar.modDownloadUrl = '';
      if (!this.newChar.relatedCharacterId) this.newChar.relatedCharacterId = '';

      if (typeof this.newChar.franchise === 'string') {
        this.newChar.franchise = [this.newChar.franchise];
      }
      if (!this.newChar.franchise || this.newChar.franchise.length === 0) {
        this.newChar.franchise = [''];
      }

      if (typeof this.newChar.theme === 'string') {
        this.newChar.theme = [this.newChar.theme];
      }
      if (!this.newChar.theme || this.newChar.theme.length === 0) {
        this.newChar.theme = [''];
      }

      if (typeof this.newChar.occupation === 'string') {
        this.newChar.occupation = [this.newChar.occupation];
      }
      if (!this.newChar.occupation || this.newChar.occupation.length === 0) {
        this.newChar.occupation = [''];
      }

      if (!this.newChar.wardrobe || this.newChar.wardrobe.length === 0) {
        this.newChar.wardrobe = [''];
      }
      if (!this.newChar.images || this.newChar.images.length === 0) {
        this.newChar.images = [''];
      }
      if (!this.newChar.popularMods || this.newChar.popularMods.length === 0) {
        this.newChar.popularMods = [{ name: '', modCreator: '', url: '', image: '' }];
      }

      this.currentView = 'capture';
    },

    async saveCharacter() {
      // 1. Subir imágenes principales del personaje pendientes
      if (this.newChar.pendingFiles && this.newChar.pendingFiles.length > 0) {
        for (const item of this.newChar.pendingFiles) {
          const publicUrl = await this.uploadImageToSupabase(item.file, 'characters');
          if (publicUrl) {
            this.newChar.images[item.index] = publicUrl;
          }
        }
        delete this.newChar.pendingFiles;
      }

      // 2. Subir imágenes de Popular Mods pendientes
      if (this.newChar.pendingModFiles && this.newChar.pendingModFiles.length > 0) {
        for (const item of this.newChar.pendingModFiles) {
          const publicUrl = await this.uploadImageToSupabase(item.file, 'mods-img');
          if (publicUrl && this.newChar.popularMods[item.index]) {
            this.newChar.popularMods[item.index].image = publicUrl;
          }
        }
        delete this.newChar.pendingModFiles;
      }

      this.newChar.franchise = this.newChar.franchise.map(f => f.trim()).filter(Boolean);
      this.newChar.theme = this.newChar.theme.map(t => t.trim()).filter(Boolean);
      this.newChar.occupation = this.newChar.occupation.map(o => o.trim()).filter(Boolean);
      this.newChar.wardrobe = this.newChar.wardrobe.map(i => i.trim()).filter(Boolean);
      this.newChar.images = this.newChar.images.map(i => i.trim()).filter(Boolean);

      if (!this.isEditing) {
        this.newChar.id = 'p-' + Date.now();
      }

      const payload = {
        id: this.newChar.id,
        name: this.newChar.name,
        alias: this.newChar.alias,
        gender: this.newChar.gender,
        model_creator: this.newChar.modelCreator,
        franchise: this.newChar.franchise,
        theme: this.newChar.theme,
        occupation: this.newChar.occupation,
        is_mod: this.newChar.isMod,
        mod_creator: this.newChar.modCreator,
        mod_download_url: this.newChar.modDownloadUrl,
        related_character_id: this.newChar.relatedCharacterId,
        physical: this.newChar.physical,
        wardrobe: this.newChar.wardrobe,
        images: this.newChar.images,
        popular_mods: this.newChar.popularMods
      };

      const { error } = await supabaseClient.from('characters').upsert(payload);

      if (error) {
        alert('Error saving character: ' + error.message);
      } else {
        alert('Character saved successfully to cloud!');
        await this.fetchCharacters();
        this.openNewCharacterForm();
        this.currentView = 'characters';
      }
    },

    async deleteCharacter(id) {
  if (confirm('Are you sure you want to delete this character?')) {
    
    // 1. Encontrar el personaje en la lista actual para acceder a sus imágenes
    const charToDelete = this.characters.find(c => c.id === id);

    if (charToDelete) {
      const pathsToDelete = [];

      // A. Recolectar rutas de las imágenes principales del personaje
      if (charToDelete.images) {
        charToDelete.images.forEach(url => {
          const path = this.extractStoragePath(url);
          if (path) pathsToDelete.push(path);
        });
      }

      // B. Recolectar rutas de las imágenes de los mods populares (si tiene)
      if (charToDelete.popularMods) {
        charToDelete.popularMods.forEach(mod => {
          if (mod.image) {
            const path = this.extractStoragePath(mod.image);
            if (path) pathsToDelete.push(path);
          }
        });
      }

      // C. Borrar los archivos físicos del Storage si hay rutas válidas
      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabaseClient.storage
          .from('wiki-images')
          .remove(pathsToDelete);
          
        if (storageError) {
          console.error('Error deleting images from storage:', storageError.message);
        }
      }
    }

    // 2. Borrar el registro de la tabla en Supabase
    const { error } = await supabaseClient.from('characters').delete().eq('id', id);
    
    if (error) {
      alert('Error deleting character: ' + error.message);
    } else {
      alert('Character deleted successfully!');
      this.closeCharacterModal(); 
      await this.fetchCharacters(); 
    }
  }
},

    async attachImages(event) {
      const files = Array.from(event.target.files);
      if (!files.length) return;

      if (!this.newChar.pendingFiles) {
        this.newChar.pendingFiles = [];
      }

      if (this.newChar.images.length === 1 && this.newChar.images[0] === '') {
        this.newChar.images = [];
      }

      for (const file of files) {
        // Optimizar la imagen antes de guardarla en memoria temporal
        const optimizedFile = await this.optimizeImageFile(file);
        
        // Guardar una vista previa local (ObjectURL) para que la veas inmediatamente en el formulario
        const previewUrl = URL.createObjectURL(optimizedFile);
        this.newChar.images.push(previewUrl);

        // Guardar el archivo optimizado en una lista pendiente para subirlo al presionar "Guardar"
        this.newChar.pendingFiles.push({
          index: this.newChar.images.length - 1,
          file: optimizedFile
        });
      }

      event.target.value = '';
    },

    addImageField() {
      this.newChar.images.push('');
    },

    removeImageField(index) {
      this.newChar.images.splice(index, 1);
      if (this.newChar.images.length === 0) {
        this.newChar.images.push('');
      }
    },

    openCharacterModal(item, type = 'character') {
      this.selectedCharacter = { ...item, type: type };
      this.activeImage = item.images?.[0] || '';
      this.characterModalVisible = true;
    },
    closeCharacterModal() {
      this.characterModalVisible = false;
      this.selectedCharacter = null;
    },
    openFranchiseModal(franchiseName) {
      this.selectedFranchise = franchiseName;
      this.franchiseModalVisible = true;
    },
    closeFranchiseModal() {
      this.franchiseModalVisible = false;
      this.selectedFranchise = '';
    },
    copyToClipboard(text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        alert('Code copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy code: ', err);
      });
    },

    // Remover miniatura de personaje
    removeCharacterImage(index) {
      this.newChar.images.splice(index, 1);
      if (this.newChar.pendingFiles) {
        this.newChar.pendingFiles = this.newChar.pendingFiles.filter(item => item.index !== index);
        // Reindexar pendientes
        this.newChar.pendingFiles.forEach(item => {
          if (item.index > index) item.index--;
        });
      }
    },

    // Remover miniatura de general mod
    removeGeneralModImage(index) {
      this.newGeneralMod.images.splice(index, 1);
      if (this.newGeneralMod.pendingFiles) {
        this.newGeneralMod.pendingFiles = this.newGeneralMod.pendingFiles.filter(item => item.index !== index);
        this.newGeneralMod.pendingFiles.forEach(item => {
          if (item.index > index) item.index--;
        });
      }
    },

    // Remover miniatura de mapa
    removeMapImage(index) {
      this.newMap.images.splice(index, 1);
      if (this.newMap.pendingFiles) {
        this.newMap.pendingFiles = this.newMap.pendingFiles.filter(item => item.index !== index);
        this.newMap.pendingFiles.forEach(item => {
          if (item.index > index) item.index--;
        });
      }
    },

  },
}).mount('#app');