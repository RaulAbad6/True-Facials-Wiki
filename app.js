const { createApp } = Vue;

// Inicializar Supabase
const SUPABASE_URL = 'https://dplsiqpbxozueacfnvfw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_r7vdvy6_I1jm17ALirWUdA_0NxnZH_7';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

      // Franquicias
      franchises: [],
      franchiseFormModalVisible: false,
      isEditingFranchise: false,
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
      const dbFranchises = this.franchises.map(f => f.name).filter(Boolean);
      const charFranchises = this.characters.flatMap(p => 
        Array.isArray(p.franchise) ? p.franchise : [p.franchise]
      ).filter(Boolean);
      return [...new Set([...dbFranchises, ...charFranchises])]
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
      if (this.franchises && this.franchises.length > 0) {
        return this.franchises.map(f => ({
          id: f.id,
          name: f.name,
          banner: f.image || ''
        }));
      }
      return this.uniqueFranchises.map(franchise => ({
        name: franchise,
        banner: ''
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
    // Auxiliar para extraer ruta de Storage
    extractStoragePath(publicUrl) {
      if (!publicUrl || typeof publicUrl !== 'string') return null;
      const marker = '/wiki-images/';
      const parts = publicUrl.split(marker);
      if (parts.length > 1) {
        return parts[1];
      }
      return null;
    },

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
        ],
        saving: false
      };
    },

    getEmptyFranchiseObject() {
      return {
        id: '',
        name: '',
        image: '',
        pendingFiles: [],
        saving: false
      };
    },

    getEmptyMapObject() {
      return {
        id: '',
        name: '',
        isMod: false,
        modCreator: '',
        url: '',
        images: [''],
        saving: false
      };
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
        images: [''],
        saving: false
      };
    },

    getEmptyOutfitMixerObject() {
      return {
        id: '',
        name: '',
        code: '',
        images: [''],
        saving: false
      };
    },

    // ---------------- FRANCHISES ----------------
    openNewFranchiseModal() {
      this.isEditingFranchise = false;
      this.newFranchise = this.getEmptyFranchiseObject();
      this.franchiseFormModalVisible = true;
    },

    closeNewFranchiseModal() {
      this.franchiseFormModalVisible = false;
      this.newFranchise = this.getEmptyFranchiseObject();
    },

    async attachFranchiseImage(event) {
      const file = event.target.files[0];
      if (!file) return;

      const optimizedFile = await this.optimizeImageFile(file);
      const previewUrl = URL.createObjectURL(optimizedFile);

      this.newFranchise.image = previewUrl;
      this.newFranchise.pendingFiles = [{ file: optimizedFile }];
      event.target.value = '';
    },

    removeFranchiseImage() {
      this.newFranchise.image = '';
      this.newFranchise.pendingFiles = [];
    },

    async saveFranchise() {
      this.newFranchise.saving = true;
      try {
        // 1. Si hay un archivo nuevo pendiente de subida
        if (this.newFranchise.pendingFiles && this.newFranchise.pendingFiles.length > 0) {
          const item = this.newFranchise.pendingFiles[0];
          
          // A. Subimos la nueva imagen a Supabase Storage
          const publicUrl = await this.uploadImageToSupabase(item.file, 'franchises');
          if (publicUrl) {
            this.newFranchise.image = publicUrl;

            // B. Si estamos editando y existía una imagen anterior distinta, la borramos del Storage
            if (this.isEditingFranchise && this.newFranchise.oldImage && this.newFranchise.oldImage !== this.newFranchise.image) {
              const oldPath = this.extractStoragePath(this.newFranchise.oldImage);
              if (oldPath) {
                const { error: storageError } = await supabaseClient.storage
                  .from('wiki-images')
                  .remove([oldPath]);
                
                if (storageError) {
                  console.error('Error removing old franchise image from storage:', storageError.message);
                }
              }
            }
          }
          delete this.newFranchise.pendingFiles;
        }

        this.newFranchise.name = this.newFranchise.name.trim();

        const payload = {
          name: this.newFranchise.name,
          image: this.newFranchise.image
        };

        if (this.isEditingFranchise && this.newFranchise.id) {
          payload.id = this.newFranchise.id;
        }

        // 2. Guardar o actualizar en la tabla 'franchises' de Supabase
        const { error } = await supabaseClient.from('franchises').upsert(payload);

        if (error) {
          alert('Error saving franchise: ' + error.message);
        } else {
          alert('Franchise saved successfully to cloud!');
          await this.fetchFranchises();
          this.closeNewFranchiseModal();
        }
      } catch (e) {
        console.error(e);
      } finally {
        this.newFranchise.saving = false;
      }
    },

    async deleteFranchise(id) {
      if (confirm('Are you sure you want to delete this franchise?')) {
        const franchiseToDelete = this.franchises.find(f => f.id === id);

        if (franchiseToDelete && franchiseToDelete.image) {
          const path = this.extractStoragePath(franchiseToDelete.image);
          if (path) {
            await supabaseClient.storage.from('wiki-images').remove([path]);
          }
        }

        const { error } = await supabaseClient.from('franchises').delete().eq('id', id);
        if (error) alert('Error deleting franchise: ' + error.message);
        else await this.fetchFranchises();
      }
    },

    async deleteFranchiseByName(franchiseName) {
      const franchise = this.franchises.find(f => f.name === franchiseName);
      if (franchise) {
        this.closeFranchiseModal();
        await this.deleteFranchise(franchise.id);
      }
    },
    // ---------------- SUBIDA Y OPTIMIZACIÓN DE IMÁGENES ----------------
    async uploadImageToSupabase(file, folder = 'characters') {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        const { error } = await supabaseClient.storage
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

    optimizeImageFile

    // ---------------- CONSULTAS A SUPABASE ----------------
    async fetchAllData() {
      await Promise.all([
        this.fetchCharacters(),
        this.fetchFranchises(),
        this.fetchGeneralMods(),
        this.fetchMaps()
      ]);
    },

    async fetchFranchises() {
      const { data, error } = await supabaseClient
        .from('franchises')
        .select('*')
        .order('name', { ascending: true });

      if (error) console.error('Error fetching franchises:', error);
      else if (data) this.franchises = data;
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

      if (error) console.error('Error fetching general mods:', error);
      else if (data) {
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

      if (error) console.error('Error fetching maps:', error);
      else if (data) {
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

    // ---------------- AUTENTICACIÓN ----------------
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

    // ---------------- MAPS ----------------
    openNewMapForm() {
      this.isEditingMap = false;
      this.newMap = this.getEmptyMapObject();
      this.currentView = 'captureMap';
    },

    openEditMapForm(map) {
  this.isEditingMap = true;
  this.newMap = JSON.parse(JSON.stringify(map));
  this.newMap.saving = false;
  this.newMap.oldImages = map.images ? [...map.images] : []; // Guardar imágenes previas

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
  this.newMap.saving = true;
  try {
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

    // Eliminar imágenes reemplazadas o eliminadas del mapa
    if (this.isEditingMap && this.newMap.oldImages) {
      const removedImages = this.newMap.oldImages.filter(oldUrl => !this.newMap.images.includes(oldUrl));
      const pathsToDelete = removedImages.map(url => this.extractStoragePath(url)).filter(Boolean);

      if (pathsToDelete.length > 0) {
        await supabaseClient.storage.from('wiki-images').remove(pathsToDelete);
      }
    }

    const payload = {
      name: this.newMap.name,
      is_mod: this.newMap.isMod,
      mod_creator: this.newMap.modCreator,
      url: this.newMap.url,
      images: this.newMap.images
    };

    if (this.newMap.id) {
      payload.id = this.newMap.id;
    }

    const { error } = await supabaseClient.from('maps').upsert(payload);

    if (error) {
      alert('Error saving map: ' + error.message);
    } else {
      alert('Map saved successfully!');
      await this.fetchMaps();
      this.openNewMapForm();
      this.currentView = 'maps';
    }
  } catch (e) {
    console.error(e);
  } finally {
    this.newMap.saving = false;
  }
},

    async deleteMap(id) {
      if (confirm('Are you sure you want to delete this map?')) {
        const mapToDelete = this.maps.find(m => m.id === id);

        if (mapToDelete && mapToDelete.images) {
          const pathsToDelete = [];
          mapToDelete.images.forEach(url => {
            const path = this.extractStoragePath(url);
            if (path) pathsToDelete.push(path);
          });

          if (pathsToDelete.length > 0) {
            await supabaseClient.storage.from('wiki-images').remove(pathsToDelete);
          }
        }

        const { error } = await supabaseClient.from('maps').delete().eq('id', id);
        if (error) alert('Error deleting map: ' + error.message);
        else await this.fetchMaps();
      }
    },

    // ---------------- GENERAL MODS ----------------
    openNewGeneralModForm() {
      this.isEditingGeneralMod = false;
      this.newGeneralMod = this.getEmptyGeneralModObject();
      this.currentView = 'captureGeneralMod';
    },

    openEditGeneralModForm(mod) {
  this.isEditingGeneralMod = true;
  this.newGeneralMod = JSON.parse(JSON.stringify(mod));
  this.newGeneralMod.saving = false;
  this.newGeneralMod.oldImages = mod.images ? [...mod.images] : []; // Guardar imágenes previas

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
        // 1. Reescalamos y optimizamos la imagen (respetando transparencia si es PNG)
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
      this.newGeneralMod.saving = true;
      try {
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

        // Si es un mod nuevo y no tiene ID, le generamos uno de tipo texto
        if (!this.newGeneralMod.id) {
          this.newGeneralMod.id = 'gmod-' + Date.now();
        }

        // Preparamos el payload incluyendo siempre el ID
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
      } catch (e) {
        console.error(e);
      } finally {
        this.newGeneralMod.saving = false;
      }
    },

    async deleteGeneralMod(id) {
      if (confirm('Are you sure you want to delete this general mod?')) {
        const modToDelete = this.generalMods.find(m => m.id === id);

        if (modToDelete && modToDelete.images) {
          const pathsToDelete = [];
          modToDelete.images.forEach(url => {
            const path = this.extractStoragePath(url);
            if (path) pathsToDelete.push(path);
          });

          if (pathsToDelete.length > 0) {
            await supabaseClient.storage.from('wiki-images').remove(pathsToDelete);
          }
        }

        const { error } = await supabaseClient.from('general_mods').delete().eq('id', id);
        if (error) alert('Error deleting mod: ' + error.message);
        else await this.fetchGeneralMods();
      }
    },

    // ---------------- OUTFIT MIXER ----------------
    openNewOutfitMixerForm() {
      this.isEditingOutfitMixer = false;
      this.newOutfitMixer = this.getEmptyOutfitMixerObject();
      this.currentView = 'captureOutfitMixer';
    },

    openEditOutfitMixerForm(item) {
      this.isEditingOutfitMixer = true;
      this.newOutfitMixer = JSON.parse(JSON.stringify(item));
      this.newOutfitMixer.saving = false;
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

    // ---------------- CHARACTERS ----------------
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
      // Ajustar pendientes de mods si se elimina un índice
      if (this.newChar.pendingModFiles) {
        this.newChar.pendingModFiles = this.newChar.pendingModFiles.filter(item => item.index !== index);
        this.newChar.pendingModFiles.forEach(item => {
          if (item.index > index) item.index--;
        });
      }
    },

    // Adjuntar imagen con vista previa para Popular Mods
    async attachModImage(event, index) {
      const file = event.target.files[0];
      if (!file) return;

      const optimizedFile = await this.optimizeImageFile(file);
      const previewUrl = URL.createObjectURL(optimizedFile);

      this.newChar.popularMods[index].image = previewUrl;

      if (!this.newChar.pendingModFiles) {
        this.newChar.pendingModFiles = [];
      }
      
      // Reemplazar si ya existía un archivo pendiente para este índice exacto
      this.newChar.pendingModFiles = this.newChar.pendingModFiles.filter(item => item.index !== index);
      this.newChar.pendingModFiles.push({
        index: index,
        file: optimizedFile
      });

      event.target.value = '';
    },

    removeModImage(index) {
      this.newChar.popularMods[index].image = '';
      if (this.newChar.pendingModFiles) {
        this.newChar.pendingModFiles = this.newChar.pendingModFiles.filter(item => item.index !== index);
      }
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
      this.newChar.saving = false;

      // Guardamos copias de seguridad de las imágenes originales para poder borrarlas del bucket si cambian o se eliminan
      this.newChar.oldImages = character.images ? [...character.images] : [];
      this.newChar.oldModImages = character.popularMods 
        ? character.popularMods.map(m => m.image).filter(Boolean) 
        : [];

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
      this.newChar.saving = true;
      try {
        // 1. Subir imágenes principales pendientes
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

        // Limpieza de datos en blanco
        this.newChar.franchise = this.newChar.franchise.map(f => f.trim()).filter(Boolean);
        this.newChar.theme = this.newChar.theme.map(t => t.trim()).filter(Boolean);
        this.newChar.occupation = this.newChar.occupation.map(o => o.trim()).filter(Boolean);
        this.newChar.wardrobe = this.newChar.wardrobe.map(i => i.trim()).filter(Boolean);
        this.newChar.images = this.newChar.images.map(i => i.trim()).filter(Boolean);

        // 3. Borrar imágenes principales viejas del Storage si fueron removidas o reemplazadas
        if (this.isEditing && this.newChar.oldImages) {
          const removedImages = this.newChar.oldImages.filter(oldUrl => !this.newChar.images.includes(oldUrl));
          const pathsToDelete = removedImages.map(url => this.extractStoragePath(url)).filter(Boolean);

          if (pathsToDelete.length > 0) {
            await supabaseClient.storage.from('wiki-images').remove(pathsToDelete);
          }
        }

        // 4. Borrar imágenes de mods viejas del Storage si fueron removidas o reemplazadas
        if (this.isEditing && this.newChar.oldModImages) {
          const currentModImages = this.newChar.popularMods.map(m => m.image).filter(Boolean);
          const removedModImages = this.newChar.oldModImages.filter(oldUrl => !currentModImages.includes(oldUrl));
          const pathsToDelete = removedModImages.map(url => this.extractStoragePath(url)).filter(Boolean);

          if (pathsToDelete.length > 0) {
            await supabaseClient.storage.from('wiki-images').remove(pathsToDelete);
          }
        }

        const payload = {
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

        if (this.newChar.id) {
          payload.id = this.newChar.id;
        }

        const { error } = await supabaseClient.from('characters').upsert(payload);

        if (error) {
          alert('Error saving character: ' + error.message);
        } else {
          alert('Character saved successfully to cloud!');
          await this.fetchCharacters();
          this.openNewCharacterForm();
          this.currentView = 'characters';
        }
      } catch (e) {
        console.error(e);
      } finally {
        this.newChar.saving = false;
      }
    },

    async deleteCharacter(id) {
      if (confirm('Are you sure you want to delete this character?')) {
        const charToDelete = this.characters.find(c => c.id === id);

        if (charToDelete) {
          const pathsToDelete = [];

          if (charToDelete.images) {
            charToDelete.images.forEach(url => {
              const path = this.extractStoragePath(url);
              if (path) pathsToDelete.push(path);
            });
          }

          if (charToDelete.popularMods) {
            charToDelete.popularMods.forEach(mod => {
              if (mod.image) {
                const path = this.extractStoragePath(mod.image);
                if (path) pathsToDelete.push(path);
              }
            });
          }

          if (pathsToDelete.length > 0) {
            await supabaseClient.storage.from('wiki-images').remove(pathsToDelete);
          }
        }

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
        const optimizedFile = await this.optimizeImageFile(file);
        const previewUrl = URL.createObjectURL(optimizedFile);
        this.newChar.images.push(previewUrl);

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
      // Pequeño retardo o simplemente mantener el objeto para evitar errores de renderizado mientras se cierra el modal
      setTimeout(() => {
        this.selectedCharacter = null;
      }, 100);
    },
    openEditModalForItem(item) {
      if (!item) return;
      this.closeCharacterModal();

      if (item.type === 'map') {
        this.openEditMapForm(item);
      } else if (item.type === 'generalMod') {
        this.openEditGeneralModForm(item);
      } else if (item.type === 'outfitMixer') {
        this.openEditOutfitMixerForm(item);
      } else {
        this.openEditCharacterForm(item);
      }
    },

    deleteModalItem(item) {
      if (!item) return;

      if (item.type === 'map') {
        this.deleteMap(item.id);
        this.closeCharacterModal();
      } else if (item.type === 'generalMod') {
        this.deleteGeneralMod(item.id);
        this.closeCharacterModal();
      } else if (item.type === 'outfitMixer') {
        this.deleteOutfitMixer(item.id);
        this.closeCharacterModal();
      } else {
        this.deleteCharacter(item.id);
      }
    },
    openFranchiseModal(franchiseName) {
      this.selectedFranchise = franchiseName;
      this.franchiseModalVisible = true;
    },
    closeFranchiseModal() {
      this.franchiseModalVisible = false;
      this.selectedFranchise = '';
    },

    // Abrir el modal en modo edición con los datos de la franquicia seleccionada
    openEditFranchiseModal(franchiseName) {
      const franchise = this.franchises.find(f => f.name === franchiseName);
      if (!franchise) return;

      this.isEditingFranchise = true;
      this.newFranchise = {
        id: franchise.id,
        name: franchise.name,
        image: franchise.image || '',
        oldImage: franchise.image || '', // <-- Guardamos la referencia de la imagen actual
        pendingFiles: []
      };
      
      this.closeFranchiseModal();
      this.franchiseFormModalVisible = true;
    },

    // Actualizamos openNewFranchiseModal para marcar que NO estamos editando
    openNewFranchiseModal() {
      this.isEditingFranchise = false;
      this.newFranchise = this.getEmptyFranchiseObject();
      this.franchiseFormModalVisible = true;
    },

    copyToClipboard(text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        alert('Code copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy code: ', err);
      });
    },

    removeCharacterImage(index) {
      this.newChar.images.splice(index, 1);
      if (this.newChar.pendingFiles) {
        this.newChar.pendingFiles = this.newChar.pendingFiles.filter(item => item.index !== index);
        this.newChar.pendingFiles.forEach(item => {
          if (item.index > index) item.index--;
        });
      }
    },

    removeGeneralModImage(index) {
      this.newGeneralMod.images.splice(index, 1);
      if (this.newGeneralMod.pendingFiles) {
        this.newGeneralMod.pendingFiles = this.newGeneralMod.pendingFiles.filter(item => item.index !== index);
        this.newGeneralMod.pendingFiles.forEach(item => {
          if (item.index > index) item.index--;
        });
      }
    },

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