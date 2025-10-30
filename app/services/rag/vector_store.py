import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from app.core.config import settings
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class VectorStoreService:
    """Servicio de almacenamiento vectorial con ChromaDB"""
    
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(
            model=settings.embedding_model,
            openai_api_key=settings.openai_api_key
        )
        
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        
        self.vectorstore = Chroma(
            client=self.client,
            collection_name=settings.collection_name,
            embedding_function=self.embeddings
        )
        
        logger.info(f"✅ VectorStore inicializado: {settings.collection_name}")
    
    def load_documents(self):
        """Carga documentos desde el directorio de datos"""
        data_path = Path(settings.data_dir)
        
        if not data_path.exists():
            logger.warning(f"⚠️ Directorio no existe: {data_path}")
            return
        
        documents = []
        
        for file_path in data_path.rglob("*"):
            if file_path.is_file():
                try:
                    if file_path.suffix == ".pdf":
                        loader = PyPDFLoader(str(file_path))
                    elif file_path.suffix in [".txt", ".md"]:
                        loader = TextLoader(str(file_path))
                    else:
                        continue
                    
                    docs = loader.load()
                    documents.extend(docs)
                    logger.info(f"📄 Cargado: {file_path.name}")
                    
                except Exception as e:
                    logger.error(f"❌ Error cargando {file_path.name}: {e}")
        
        if documents:
            self._index_documents(documents)
        else:
            logger.warning("⚠️ No se encontraron documentos")
    
    def _index_documents(self, documents):
        """Indexa documentos en ChromaDB"""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap
        )
        
        chunks = text_splitter.split_documents(documents)
        logger.info(f"📊 Generando {len(chunks)} chunks...")
        
        self.vectorstore.add_documents(chunks)
        logger.info(f"✅ {len(chunks)} chunks indexados")
    
    def search(self, query: str, k: int = None) -> list:
        """Busca documentos relevantes"""
        k = k or settings.top_k_results
        
        results = self.vectorstore.similarity_search(query, k=k)
        logger.info(f"🔍 Encontrados {len(results)} resultados para: {query[:50]}...")
        
        return results
    
    def get_context(self, query: str) -> str:
        """Obtiene contexto relevante como string"""
        results = self.search(query)
        
        context = "\n\n".join([doc.page_content for doc in results])
        return context
