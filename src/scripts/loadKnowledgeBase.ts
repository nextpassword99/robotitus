import { VectorStoreService } from '../services/vectorStore.service.js';

async function main() {
  console.log('📚 Cargando base de conocimiento...');
  const vectorStore = new VectorStoreService();
  await vectorStore.loadDocuments();
  console.log('✅ Base de conocimiento cargada exitosamente');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
